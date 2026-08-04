import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { PERMISSIONS, can, type Permission, type PermissionMode } from '../lib/access.js';
import { writeAudit } from '../lib/audit.js';
import { queueEmail } from '../lib/email.js';
import { updateMembership } from '../lib/identityService.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { rotateUserAuthVersion } from '../lib/sessionSecurity.js';
import { requirePermission, requireStaff, requireUser } from '../middleware/auth.js';

export const adminSecurityRouter = Router();
adminSecurityRouter.use(requireUser, requireStaff);

const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25);
const optionalText = z.string().trim().max(5000).optional().default('');
const permissionModeSchema = z.enum(['additive','replace']).default('additive');

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function invitationToken() { return crypto.randomBytes(32).toString('base64url'); }
function tokenHash(token: string) { return crypto.createHash('sha256').update(token).digest('hex'); }
function escapeLike(value: string) { return value.replace(/[,%()]/g, ' ').trim(); }

async function getProfileByEmail(email: string) {
  const { data, error } = await supabaseAdmin.from('profiles').select('id,full_name,email_normalized').eq('email_normalized', email).maybeSingle();
  if (error) throw error;
  return data;
}

async function getStaffRole(roleKey: string) {
  const { data, error } = await supabaseAdmin.from('staff_roles').select('*').eq('key', roleKey).eq('is_active', true).single();
  if (error) throw error;
  return data as { key:string; permissions:string[]; is_super_admin:boolean; name:string };
}

function assertPermissionsAssignable(req: Request, requested: string[]) {
  const unknown = requested.filter((item) => !PERMISSIONS.includes(item as Permission));
  if (unknown.length) throw new Error(`Unknown permissions: ${unknown.join(', ')}`);
  if (req.access?.isSuperAdmin) return;
  if (!can(req.access, 'assign_permissions')) throw new Error('Permission assignment is not allowed.');
  const actorPermissions = new Set(req.access?.permissions ?? []);
  const elevated = requested.filter((item) => !actorPermissions.has(item));
  if (elevated.length) throw new Error('You cannot grant permissions you do not hold.');
}

async function assertRoleAssignable(req: Request, roleKey: string, permissionMode: PermissionMode, customPermissions: string[]) {
  const role = await getStaffRole(roleKey);
  if (role.is_super_admin) throw new Error('The permanent Super Admin role cannot be assigned to another account.');
  if (role.key === 'admin' && !req.access?.isSuperAdmin) throw new Error('Only the permanent Super Admin can create or assign an Administrator.');
  if (!req.access?.isSuperAdmin) {
    const requested = permissionMode === 'replace'
      ? customPermissions
      : Array.from(new Set([...role.permissions.filter((permission) => permission !== '*'), ...customPermissions]));
    assertPermissionsAssignable(req, requested);
  }
  return role;
}

function effectivePermissions(role: { permissions:string[]; is_super_admin:boolean }, customPermissions: string[], permissionMode: PermissionMode) {
  if (role.is_super_admin) return ['*'];
  return permissionMode === 'replace'
    ? Array.from(new Set(customPermissions))
    : Array.from(new Set([...role.permissions.filter((permission) => permission !== '*'), ...customPermissions]));
}

async function ensureLastSuperAdminIsPreserved(userId: string, nextRoleKey?: string, nextStatus?: string) {
  const current = await supabaseAdmin.from('staff_memberships').select('role_key,status').eq('user_id', userId).maybeSingle();
  if (current.error) throw current.error;
  if (current.data?.role_key !== 'super_admin' || current.data.status !== 'active') return;
  if ((nextRoleKey ?? current.data.role_key) === 'super_admin' && (nextStatus ?? current.data.status) === 'active') return;
  const { count, error } = await supabaseAdmin.from('staff_memberships').select('*', { count:'exact', head:true }).eq('role_key','super_admin').eq('status','active');
  if (error) throw error;
  if ((count ?? 0) <= 1) throw new Error('At least one active super admin must remain.');
}

const STAFF_STATUS_TRANSITIONS:Record<string,readonly string[]>={
  invited:['invited','deactivated'],
  active:['active','suspended','deactivated'],
  suspended:['suspended','active','deactivated'],
  deactivated:['deactivated','active']
};

function assertStaffStatusTransition(currentStatus:string,nextStatus:string){
  const allowed=STAFF_STATUS_TRANSITIONS[currentStatus]??[];
  if(!allowed.includes(nextStatus)){
    throw new Error(`Staff status cannot change from ${currentStatus} to ${nextStatus}.`);
  }
  if(currentStatus!=='invited'&&nextStatus==='invited'){
    throw new Error('An existing employee cannot be moved back into the invitation state.');
  }
}

adminSecurityRouter.get('/roles', requirePermission('manage_staff'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('staff_roles').select('*').eq('is_active', true).order('name');
    if (error) throw error;
    const roles = req.access?.isSuperAdmin ? (data ?? []) : (data ?? []).filter((role) => !role.is_super_admin && role.key !== 'admin');
    res.json({ roles, permissions:PERMISSIONS });
  } catch (error) { next(error); }
});

adminSecurityRouter.get('/members', requirePermission('view_members'), async (req, res, next) => {
  try {
    const page = pageSchema.parse(req.query.page);
    const pageSize = pageSizeSchema.parse(req.query.pageSize);
    const search = escapeLike(String(req.query.search || ''));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabaseAdmin.from('profiles').select(
      'id,full_name,email_normalized,phone,country,city,avatar_url,headline,bio,skills,membership_level,membership_status,membership_plan_id,membership_expires_at,is_directory_visible,account_status,created_at,updated_at',
      { count:'exact' }
    );
    if (search) query = query.or(`full_name.ilike.%${search}%,email_normalized.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`);
    const [{ data, error, count }, superAdmin] = await Promise.all([
      query.order('created_at',{ascending:false}).range(from,to),
      supabaseAdmin.from('staff_memberships').select('user_id').eq('role_key','super_admin').maybeSingle()
    ]);
    if (error) throw error;
    if (superAdmin.error) throw superAdmin.error;
    const items = (data ?? []).map((row) => ({ ...row, is_permanent_super_admin: row.id === superAdmin.data?.user_id }));
    res.json({ items, page, pageSize, total:count ?? 0 });
  } catch (error) { next(error); }
});

adminSecurityRouter.patch('/members/:id/membership', requirePermission('manage_memberships'), async (req, res, next) => {
  try {
    const memberId = z.string().uuid().parse(req.params.id);
    const input = z.object({
      membershipStatus:z.enum(['inactive','pending','trialing','active','past_due','paused','cancelled','expired']).optional(),
      membershipLevel:z.enum(['rise','legacy','elite']).nullable().optional(),
      membershipPlanId:z.string().uuid().nullable().optional(),
      membershipExpiresAt:z.string().datetime().nullable().optional(),
      membershipBillingCycle:z.enum(['monthly','yearly','one_time']).nullable().optional(),
      reason:z.string().trim().min(3).max(500)
    }).parse(req.body);
    const membershipChanges: Parameters<typeof updateMembership>[1] = {};
    if(input.membershipStatus!==undefined)membershipChanges.membership_status=input.membershipStatus;
    if(input.membershipLevel!==undefined)membershipChanges.membership_level=input.membershipLevel;
    if(input.membershipPlanId!==undefined)membershipChanges.membership_plan_id=input.membershipPlanId;
    if(input.membershipExpiresAt!==undefined)membershipChanges.membership_expires_at=input.membershipExpiresAt;
    if(input.membershipBillingCycle!==undefined)membershipChanges.membership_billing_cycle=input.membershipBillingCycle;
    if (!Object.keys(membershipChanges).length) return res.status(400).json({ error:'No membership fields were supplied.' });
    const result = await updateMembership(memberId, membershipChanges);
    await writeAudit(req,{ action:'membership_update',entityType:'profiles',entityId:memberId,summary:input.reason,beforeData:result.before,afterData:result.after });
    res.json(result.after);
  } catch (error) { next(error); }
});

adminSecurityRouter.patch('/members/:id/account-status', requirePermission('manage_members'), async (req,res,next)=>{
  try {
    const memberId=z.string().uuid().parse(req.params.id);
    const input=z.object({status:z.enum(['active','suspended','deactivated']),reason:z.string().trim().min(3).max(500)}).parse(req.body);
    if(memberId===req.profile!.id && input.status!=='active') return res.status(400).json({error:'You cannot suspend or deactivate your own account.'});
    const [before, targetStaff] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id',memberId).single(),
      supabaseAdmin.from('staff_memberships').select('role_key').eq('user_id',memberId).maybeSingle()
    ]);
    if(before.error)throw before.error;
    if(targetStaff.error)throw targetStaff.error;
    if(targetStaff.data?.role_key==='super_admin' && input.status!=='active') return res.status(409).json({error:'The permanent Super Admin account cannot be suspended or deactivated.'});
    const {data,error}=await supabaseAdmin.from('profiles').update({account_status:input.status}).eq('id',memberId).select().single();
    if(error)throw error;
    try{
      await rotateUserAuthVersion(memberId,{accountStatus:input.status});
    }catch(sessionError){
      await supabaseAdmin.from('profiles').update({account_status:before.data.account_status}).eq('id',memberId);
      throw sessionError;
    }
    await writeAudit(req,{action:'account_status_change',entityType:'profiles',entityId:memberId,summary:input.reason,beforeData:before.data,afterData:data});
    res.json(data);
  }catch(error){next(error)}
});

adminSecurityRouter.get('/mentors', requirePermission('view_mentors'), async (req,res,next)=>{
  try{
    const page=pageSchema.parse(req.query.page);const pageSize=pageSizeSchema.parse(req.query.pageSize);const search=escapeLike(String(req.query.search||''));
    const from=(page-1)*pageSize,to=from+pageSize-1;
    let query=supabaseAdmin.from('mentor_profiles').select('*,profile:profiles!mentor_profiles_user_id_fkey(id,full_name,email_normalized,avatar_url,country,city,headline,account_status)',{count:'exact'});
    if(search){
      const matching=await supabaseAdmin.from('profiles').select('id').or(`full_name.ilike.%${search}%,email_normalized.ilike.%${search}%`).limit(500);
      if(matching.error)throw matching.error;
      const ids=(matching.data??[]).map(row=>row.id);
      if(!ids.length)return res.json({items:[],page,pageSize,total:0});
      query=query.in('user_id',ids);
    }
    const {data,error,count}=await query.order('created_at',{ascending:false}).range(from,to);if(error)throw error;
    res.json({items:data??[],page,pageSize,total:count??0});
  }catch(error){next(error)}
});

adminSecurityRouter.post('/mentors/self', requirePermission('manage_mentors'), async (req,res,next)=>{
  try{
    if(!req.access?.isSuperAdmin)return res.status(403).json({error:'Only the permanent Super Admin can add their own mentor profile from this action.'});
    const existing=await supabaseAdmin.from('mentor_profiles').select('*').eq('user_id',req.profile!.id).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data){
      if(['rejected','deactivated'].includes(existing.data.profile_status)){
        const {data,error}=await supabaseAdmin.from('mentor_profiles').update({profile_status:'profile_incomplete',is_active:false,directory_visible:false,approved_by:null,approved_at:null,rejected_at:null,rejection_reason:null}).eq('user_id',req.profile!.id).select().single();
        if(error)throw error;
        await writeAudit(req,{action:'super_admin_self_mentor_reopened',entityType:'mentor_profiles',entityId:req.profile!.id,summary:'Permanent Super Admin reopened their own mentor profile. Membership and staff access were not changed.',beforeData:existing.data,afterData:data});
        return res.json({message:'Your mentor profile is ready to complete.',mentorProfile:data});
      }
      return res.json({message:'A mentor profile is already linked to your account.',mentorProfile:existing.data});
    }
    const {data,error}=await supabaseAdmin.from('mentor_profiles').insert({user_id:req.profile!.id,profile_status:'profile_incomplete',directory_visible:false,is_active:false}).select().single();
    if(error)throw error;
    await writeAudit(req,{action:'super_admin_self_mentor_created',entityType:'mentor_profiles',entityId:req.profile!.id,summary:'Permanent Super Admin added their own separate mentor profile. Membership and staff access were not changed.',afterData:data});
    res.status(201).json({message:'Your mentor profile was created. Complete it before approval.',mentorProfile:data});
  }catch(error){next(error)}
});

adminSecurityRouter.post('/mentor-invitations', requirePermission('manage_invitations'), async (req,res,next)=>{
  try{
    const input=z.object({
      fullName:z.string().trim().min(2).max(120),email:z.string().email(),professionalTitle:optionalText,
      expertise:z.array(z.string().trim().min(1)).default([]),expiresInDays:z.coerce.number().int().min(1).max(30).default(7)
    }).parse(req.body);
    const email=normalizeEmail(input.email);
    const duplicate=await supabaseAdmin.from('mentor_invitations').select('id,status,expires_at').eq('email_normalized',email).in('status',['invited','accepted','profile_incomplete','pending_approval']).maybeSingle();
    if(duplicate.error)throw duplicate.error;
    if(duplicate.data)return res.status(409).json({error:'An active mentor invitation already exists for this email.',invitation:duplicate.data});

    let profile=await getProfileByEmail(email);
    const token=invitationToken();
    const expiresAt=new Date(Date.now()+input.expiresInDays*86400000).toISOString();
    const redirectTo=`${env.APP_URL}/mentor-onboarding?mentor_invitation=${encodeURIComponent(token)}`;

    if(!profile){
      const invited=await supabaseAdmin.auth.admin.inviteUserByEmail(email,{redirectTo,data:{full_name:input.fullName,mentor_invitation:true}});
      if(invited.error||!invited.data.user)throw invited.error||new Error('Supabase invitation could not be created.');
      profile=await getProfileByEmail(email);
      if(!profile){
        const inserted=await supabaseAdmin.from('profiles').upsert({id:invited.data.user.id,full_name:input.fullName,email_normalized:email},{onConflict:'id'}).select('id,full_name,email_normalized').single();
        if(inserted.error)throw inserted.error;profile=inserted.data;
      }
    }else{
      await queueEmail({to:email,name:profile.full_name||input.fullName,templateKey:'mentor_invitation',subject:'You are invited to mentor with Women Rise Legacy',payload:{mentorName:profile.full_name||input.fullName,inviteUrl:redirectTo}});
    }

    const {data:mentorProfile,error:mentorError}=await supabaseAdmin.from('mentor_profiles').upsert({
      user_id:profile.id,professional_title:input.professionalTitle||null,expertise:input.expertise,
      profile_status:'invited',directory_visible:false,is_active:false
    },{onConflict:'user_id'}).select().single();
    if(mentorError)throw mentorError;
    const {data:invitation,error}=await supabaseAdmin.from('mentor_invitations').insert({
      email,email_normalized:email,user_id:profile.id,token_hash:tokenHash(token),status:'invited',invited_by:req.profile!.id,expires_at:expiresAt
    }).select().single();
    if(error)throw error;
    await writeAudit(req,{action:'mentor_invitation_created',entityType:'mentor_invitations',entityId:invitation.id,summary:`Invited mentor ${email}`,afterData:{...invitation,token_hash:'[redacted]',mentorProfile}});
    res.status(201).json({message:'Mentor invitation sent.',invitation:{...invitation,token_hash:undefined}});
  }catch(error){next(error)}
});

adminSecurityRouter.get('/mentor-invitations', requirePermission('manage_invitations'), async (req,res,next)=>{
  try{
    const page=pageSchema.parse(req.query.page),pageSize=pageSizeSchema.parse(req.query.pageSize),from=(page-1)*pageSize,to=from+pageSize-1;
    const {data,error,count}=await supabaseAdmin.from('mentor_invitations').select('id,email,user_id,status,invited_by,invited_at,accepted_at,expires_at,revoked_at,last_sent_at,resend_count,created_at,updated_at',{count:'exact'}).order('created_at',{ascending:false}).range(from,to);
    if(error)throw error;res.json({items:data??[],page,pageSize,total:count??0});
  }catch(error){next(error)}
});

adminSecurityRouter.post('/mentor-invitations/:id/revoke', requirePermission('manage_invitations'), async (req,res,next)=>{
  try{
    const invitationId=z.string().uuid().parse(req.params.id);
    const input=z.object({reason:z.string().trim().min(3).max(500)}).parse(req.body);
    const before=await supabaseAdmin.from('mentor_invitations').select('*').eq('id',invitationId).single();if(before.error)throw before.error;
    if(!['invited','accepted','profile_incomplete','pending_approval'].includes(before.data.status))return res.status(409).json({error:'This invitation is no longer revocable.'});
    const {data,error}=await supabaseAdmin.from('mentor_invitations').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('id',invitationId).select().single();if(error)throw error;
    await writeAudit(req,{action:'mentor_invitation_revoked',entityType:'mentor_invitations',entityId:invitationId,summary:input.reason,beforeData:{...before.data,token_hash:'[redacted]'},afterData:{...data,token_hash:'[redacted]'}});
    res.json({message:'Invitation revoked.',invitation:{...data,token_hash:undefined}});
  }catch(error){next(error)}
});

adminSecurityRouter.patch('/mentors/:id/review', requirePermission('approve_mentors'), async (req,res,next)=>{
  try{
    const mentorId=z.string().uuid().parse(req.params.id);
    const input=z.object({decision:z.enum(['approve','reject','suspend','reactivate','deactivate']),reason:z.string().trim().max(1000).optional().default(''),directoryVisible:z.boolean().optional().default(true)}).parse(req.body);
    const before=await supabaseAdmin.from('mentor_profiles').select('*').eq('user_id',mentorId).single();if(before.error)throw before.error;
    const isSelfReview=mentorId===req.profile!.id;
    if(isSelfReview&&!req.access?.isSuperAdmin)return res.status(403).json({error:'Only the permanent Super Admin may approve their own mentor profile.'});
    if(input.decision==='approve'){
      if(before.data.profile_status!=='pending_approval')return res.status(409).json({error:'Only a submitted mentor profile can be approved.'});
      const missing=[!before.data.professional_title&&'professional title',!before.data.biography&&'biography',!(before.data.expertise?.length)&&'expertise',!before.data.availability&&'availability',!before.data.timezone&&'timezone',!before.data.session_format&&'session format',!before.data.consent_accepted_at&&'consent'].filter(Boolean);
      if(missing.length)return res.status(409).json({error:`Mentor profile is incomplete: ${missing.join(', ')}.`});
    }
    if(input.decision==='reject'&&before.data.profile_status!=='pending_approval')return res.status(409).json({error:'Only a submitted mentor profile can be rejected.'});
    if(input.decision==='suspend'&&before.data.profile_status!=='approved')return res.status(409).json({error:'Only an approved mentor can be suspended.'});
    if(input.decision==='reactivate'&&before.data.profile_status!=='suspended')return res.status(409).json({error:'Only a suspended mentor can be reactivated.'});
    const now=new Date().toISOString();const update:Record<string,unknown>={};
    if(input.decision==='approve')Object.assign(update,{profile_status:'approved',verification_status:before.data.verification_status==='rejected'?'pending':before.data.verification_status,approved_by:req.profile!.id,approved_at:now,rejected_at:null,rejection_reason:null,is_active:true,directory_visible:input.directoryVisible});
    if(input.decision==='reject')Object.assign(update,{profile_status:'rejected',rejected_at:now,rejection_reason:input.reason||'Profile did not meet approval requirements.',is_active:false,directory_visible:false});
    if(input.decision==='suspend')Object.assign(update,{profile_status:'suspended',is_active:false,directory_visible:false,rejection_reason:input.reason||null});
    if(input.decision==='reactivate')Object.assign(update,{profile_status:'approved',is_active:true,directory_visible:input.directoryVisible,rejection_reason:null});
    if(input.decision==='deactivate')Object.assign(update,{profile_status:'deactivated',is_active:false,directory_visible:false,rejection_reason:input.reason||null});
    const {data,error}=await supabaseAdmin.from('mentor_profiles').update(update).eq('user_id',mentorId).select().single();if(error)throw error;
    if(input.decision==='approve'||input.decision==='reject'){
      const invitationStatus=input.decision==='approve'?'approved':'rejected';
      const invitationUpdate=await supabaseAdmin.from('mentor_invitations').update({status:invitationStatus}).eq('user_id',mentorId).in('status',['accepted','profile_incomplete','pending_approval']);
      if(invitationUpdate.error)throw invitationUpdate.error;
    }
    const auditAction=isSelfReview&&input.decision==='approve'?'mentor_self_approved':`mentor_${input.decision}`;
    const auditSummary=isSelfReview&&input.decision==='approve'
      ? (input.reason||'Permanent Super Admin approved their own completed mentor profile.')
      : (input.reason||`Mentor ${input.decision}`);
    await writeAudit(req,{action:auditAction,entityType:'mentor_profiles',entityId:mentorId,summary:auditSummary,beforeData:before.data,afterData:data});
    res.json({mentorProfile:data,selfReview:isSelfReview});
  }catch(error){next(error)}
});

adminSecurityRouter.get('/team', requirePermission('manage_staff'), async (req,res,next)=>{
  try{
    const page=pageSchema.parse(req.query.page);
    const pageSize=pageSizeSchema.parse(req.query.pageSize);
    const search=escapeLike(String(req.query.search||''));
    const status=z.enum(['invited','active','suspended','deactivated']).optional().parse(req.query.status||undefined);
    const from=(page-1)*pageSize,to=from+pageSize-1;
    let query=supabaseAdmin.from('staff_memberships').select('*,role:staff_roles!staff_memberships_role_key_fkey(*),profile:profiles!staff_memberships_user_id_fkey(id,full_name,email_normalized,avatar_url,account_status)',{count:'exact'});
    if(status)query=query.eq('status',status);
    if(search){
      const [profileMatches,staffMatches]=await Promise.all([
        supabaseAdmin.from('profiles').select('id').or(`full_name.ilike.%${search}%,email_normalized.ilike.%${search}%`).limit(500),
        supabaseAdmin.from('staff_memberships').select('user_id').or(`job_title.ilike.%${search}%,department.ilike.%${search}%`).limit(500)
      ]);
      if(profileMatches.error)throw profileMatches.error;
      if(staffMatches.error)throw staffMatches.error;
      const ids=Array.from(new Set([...(profileMatches.data??[]).map(row=>row.id),...(staffMatches.data??[]).map(row=>row.user_id)]));
      if(!ids.length)return res.json({items:[],page,pageSize,total:0});
      query=query.in('user_id',ids);
    }
    const {data,error,count}=await query.order('created_at',{ascending:false}).range(from,to);
    if(error)throw error;
    const items=(data??[]).map((row)=>{
      const role=row.role as unknown as {permissions:string[];is_super_admin:boolean};
      const permissionMode=(row.permission_mode||'additive') as PermissionMode;
      return {...row,permission_mode:permissionMode,effective_permissions:effectivePermissions(role,row.custom_permissions??[],permissionMode)};
    });
    res.json({items,page,pageSize,total:count??0});
  }catch(error){next(error)}
});

adminSecurityRouter.post('/team/invite', requirePermission('manage_staff'), requirePermission('assign_roles'), async (req,res,next)=>{
  try{
    const input=z.object({fullName:z.string().trim().min(2).max(120),email:z.string().email(),roleKey:z.string().min(2),jobTitle:optionalText,department:optionalText,permissionMode:permissionModeSchema,customPermissions:z.array(z.string()).default([])}).parse(req.body);
    assertPermissionsAssignable(req,input.customPermissions);
    const role=await assertRoleAssignable(req,input.roleKey,input.permissionMode,input.customPermissions);
    const email=normalizeEmail(input.email);let profile=await getProfileByEmail(email);let newAuthUser=false;
    if(!profile){
      const invited=await supabaseAdmin.auth.admin.inviteUserByEmail(email,{redirectTo:`${env.APP_URL}/staff-onboarding`,data:{full_name:input.fullName,staff_invitation:true}});
      if(invited.error||!invited.data.user)throw invited.error||new Error('Staff invitation could not be created.');newAuthUser=true;
      const inserted=await supabaseAdmin.from('profiles').upsert({id:invited.data.user.id,full_name:input.fullName,email_normalized:email},{onConflict:'id'}).select('id,full_name,email_normalized').single();if(inserted.error)throw inserted.error;profile=inserted.data;
    }
    const existing=await supabaseAdmin.from('staff_memberships').select('*').eq('user_id',profile.id).maybeSingle();if(existing.error)throw existing.error;
    if(existing.data&&existing.data.status!=='deactivated')return res.status(409).json({error:'This account already has staff access.'});
    const now=new Date().toISOString();
    const {data,error}=await supabaseAdmin.from('staff_memberships').upsert({user_id:profile.id,role_key:role.key,permission_mode:input.permissionMode,custom_permissions:input.customPermissions,status:newAuthUser?'invited':'active',job_title:input.jobTitle||null,department:input.department||null,invited_by:req.profile!.id,invited_at:now,accepted_at:newAuthUser?null:now,activated_at:newAuthUser?null:now,suspended_at:null,deactivated_at:null,status_reason:null},{onConflict:'user_id'}).select().single();if(error)throw error;
    try{
      await rotateUserAuthVersion(profile.id);
    }catch(sessionError){
      if(existing.data)await supabaseAdmin.from('staff_memberships').upsert(existing.data,{onConflict:'user_id'});
      else await supabaseAdmin.from('staff_memberships').delete().eq('user_id',profile.id);
      throw sessionError;
    }
    if(!newAuthUser)await queueEmail({to:email,name:profile.full_name||input.fullName,templateKey:'staff_invitation',subject:'Women Rise Legacy team access',payload:{role:role.name,loginUrl:`${env.APP_URL}/login`}});
    await writeAudit(req,{action:'staff_added',entityType:'staff_memberships',entityId:profile.id,summary:`Added ${email} as ${role.name} with ${input.permissionMode==='replace'?'exact custom':'role-based'} access.`,afterData:{...data,effective_permissions:effectivePermissions(role,input.customPermissions,input.permissionMode)}});
    res.status(201).json(data);
  }catch(error){next(error)}
});

adminSecurityRouter.put('/team/:id', requirePermission('manage_staff'), requirePermission('assign_roles'), async (req,res,next)=>{
  try{
    const staffUserId=z.string().uuid().parse(req.params.id);
    const input=z.object({roleKey:z.string().min(2),status:z.enum(['invited','active','suspended','deactivated']),jobTitle:optionalText,department:optionalText,permissionMode:permissionModeSchema,customPermissions:z.array(z.string()).default([]),reason:z.string().trim().min(3).max(500),confirmed:z.literal(true)}).parse(req.body);
    const before=await supabaseAdmin.from('staff_memberships').select('*').eq('user_id',staffUserId).single();if(before.error)throw before.error;
    if(before.data.role_key==='super_admin')return res.status(409).json({error:'The permanent Super Admin account cannot be edited, suspended, deactivated or replaced from Team & Permissions.'});
    if(staffUserId===req.profile!.id)return res.status(400).json({error:'You cannot change your own staff role, status or permissions.'});
    assertStaffStatusTransition(before.data.status,input.status);
    assertPermissionsAssignable(req,input.customPermissions);
    const role=await assertRoleAssignable(req,input.roleKey,input.permissionMode,input.customPermissions);
    await ensureLastSuperAdminIsPreserved(staffUserId,input.roleKey,input.status);
    const now=new Date().toISOString();
    const update={role_key:role.key,status:input.status,permission_mode:input.permissionMode,job_title:input.jobTitle||null,department:input.department||null,custom_permissions:input.customPermissions,status_reason:input.reason,activated_at:input.status==='active'?before.data.activated_at||now:before.data.activated_at,suspended_at:input.status==='suspended'?now:null,deactivated_at:input.status==='deactivated'?now:null};
    const {data,error}=await supabaseAdmin.from('staff_memberships').update(update).eq('user_id',staffUserId).select().single();if(error)throw error;
    try{
      await rotateUserAuthVersion(staffUserId);
    }catch(sessionError){
      await supabaseAdmin.from('staff_memberships').update({
        role_key:before.data.role_key,status:before.data.status,permission_mode:before.data.permission_mode,job_title:before.data.job_title,department:before.data.department,custom_permissions:before.data.custom_permissions,status_reason:before.data.status_reason,activated_at:before.data.activated_at,suspended_at:before.data.suspended_at,deactivated_at:before.data.deactivated_at
      }).eq('user_id',staffUserId);
      throw sessionError;
    }
    await writeAudit(req,{action:'staff_access_changed',entityType:'staff_memberships',entityId:staffUserId,summary:input.reason,beforeData:before.data,afterData:{...data,effective_permissions:effectivePermissions(role,input.customPermissions,input.permissionMode)}});
    res.json(data);
  }catch(error){next(error)}
});

adminSecurityRouter.get('/audit', requirePermission('view_audit'), async (req,res,next)=>{
  try{const page=pageSchema.parse(req.query.page),pageSize=pageSizeSchema.parse(req.query.pageSize),from=(page-1)*pageSize,to=from+pageSize-1;const {data,error,count}=await supabaseAdmin.from('admin_audit_logs').select('*',{count:'exact'}).order('created_at',{ascending:false}).range(from,to);if(error)throw error;res.json({items:data??[],page,pageSize,total:count??0})}catch(error){next(error)}
});
