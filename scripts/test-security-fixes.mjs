import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const checks=[];
function check(name,fn){try{fn();checks.push({name,ok:true})}catch(error){checks.push({name,ok:false,error:error.message})}}

const migration=read('supabase/migrations/009_security_roles_mentors.sql');
const migration011=read('supabase/migrations/011_single_super_admin_and_permission_overrides.sql');
const auth=read('server/src/middleware/auth.ts');
const access=read('server/src/lib/access.ts');
const adminSecurity=read('server/src/routes/adminSecurity.ts');
const admin=read('server/src/routes/admin.ts');
const adminPhase4=read('server/src/routes/adminPhase4.ts');
const phase4=read('server/src/routes/phase4.ts');
const publicRoutes=read('server/src/routes/public.ts');
const app=read('client/src/App.tsx');
const phase5=read('client/src/pages/AdminPhase5.tsx');
const securityUi=read('client/src/pages/AdminSecurity.tsx');
const adminUi=read('client/src/pages/Admin.tsx');
const dashboard=read('client/src/pages/Dashboard.tsx');

check('Profiles revoke broad authenticated updates',()=>assert.match(migration,/revoke update on public\.profiles from authenticated/i));
check('Only safe profile columns are granted',()=>{assert.match(migration,/grant update \([\s\S]*full_name[\s\S]*languages[\s\S]*\) on public\.profiles to authenticated/i);assert.doesNotMatch(migration,/grant update \([\s\S]*membership_status[\s\S]*\) on public\.profiles/i)});
check('Member, mentor and staff data are separate',()=>{assert.match(migration,/create table if not exists public\.mentor_profiles/i);assert.match(migration,/create table if not exists public\.staff_memberships/i);assert.match(migration,/update public\.profiles set role='member' where role='mentor'/i)});
check('Limited roles do not receive wildcard authority',()=>{assert.match(migration,/content_manager[\s\S]*array\['view_overview','manage_content'\]/i);assert.match(migration,/donation_manager[\s\S]*array\['view_overview','manage_donations','view_reports'\]/i)});
check('Backend uses explicit permission middleware',()=>{assert.match(auth,/requirePermission/);assert.match(adminSecurity,/requirePermission\('assign_roles'\)/);assert.doesNotMatch(auth,/\['admin'\s*,\s*'content_manager'\s*,\s*'donation_manager'\]/)});
check('Admin frontend is staff protected',()=>assert.match(app,/ProtectedRoute requireStaff/));
check('Legacy combined identity update endpoints are disabled',()=>{assert.match(admin,/legacy endpoint is disabled/i);assert.match(adminPhase4,/Legacy combined member\/mentor\/role endpoint disabled/i)});
check('Mentor invitation does not grant staff access',()=>{const block=adminSecurity.slice(adminSecurity.indexOf("post('/mentor-invitations"),adminSecurity.indexOf("get('/mentor-invitations"));assert.doesNotMatch(block,/staff_memberships/);assert.match(block,/directory_visible:false,is_active:false/)});
check('Mentor directory requires approved active visible profiles',()=>{assert.match(publicRoutes,/\.eq\('profile_status','approved'\)\.eq\('is_active',true\)\.eq\('directory_visible',true\)/)});
check('Mentor approval requires submitted complete profile',()=>{assert.match(adminSecurity,/Only a submitted mentor profile can be approved/);assert.match(adminSecurity,/Mentor profile is incomplete/)});
check('Mentor must accept before match activates',()=>{assert.match(adminPhase4,/status: 'pending_mentor'/);assert.match(phase4,/eq\('status', 'pending_mentor'\)/);assert.match(phase4,/mentor_accepted_at: now/)});
check('Pending matches cannot schedule sessions',()=>{assert.match(adminPhase4,/status !== 'active' \|\| !match\.data\.mentor_accepted_at/);assert.match(phase5,/m\.status==='active'&&m\.mentor_accepted_at/);assert.doesNotMatch(phase5,/\['pending_mentor','active'\]\.includes\(m\.status\)/)});
check('Database session trigger enforces active approved participants',()=>{assert.match(migration,/validate_mentor_session_eligibility/);assert.match(migration,/m\.status <> 'active' or m\.mentor_accepted_at is null/);assert.match(migration,/mp\.profile_status <> 'approved'/)});
check('Team role changes require confirmation and audit',()=>{assert.match(adminSecurity,/confirmed:z\.literal\(true\)/);assert.match(adminSecurity,/staff_access_changed/);assert.match(adminSecurity,/ensureLastSuperAdminIsPreserved/)});
check('Staff invitation has separate acceptance flow',()=>{assert.match(adminSecurity,/staff-onboarding/);assert.match(read('server/src/routes/access.ts'),/staff-invitation\/accept/);assert.match(app,/staff-onboarding/)});
check('Server-side pagination and email search exist',()=>{assert.match(adminSecurity,/pageSizeSchema/);assert.match(adminSecurity,/email_normalized\.ilike/);assert.match(adminSecurity,/\.range\(from,to\)/)});
check('Sensitive action audit coverage exists',()=>{for(const action of ['mentor_invitation_created','mentor_invitation_revoked','membership_update','staff_added','staff_access_changed'])assert.match(adminSecurity,new RegExp(action));assert.match(phase4,/match_accepted/);assert.match(adminPhase4,/session_scheduled/)});
check('Permission catalog separates applications, submissions and email queue',()=>{for(const permission of ['view_applications','manage_applications','manage_submissions','manage_email_queue'])assert.match(access,new RegExp(permission));});
check('Exact permission replacement mode is supported',()=>{assert.match(migration011,/permission_mode in \('additive','replace'\)/);assert.match(access,/permissionMode === 'replace'/);assert.match(adminSecurity,/permissionMode:permissionModeSchema/)});
check('Only one permanent Super Admin record is allowed',()=>{assert.match(migration011,/idx_staff_memberships_single_super_admin/);assert.match(migration011,/protect_permanent_super_admin_trigger/);assert.match(migration011,/requires exactly one active Super Admin/);assert.match(adminSecurity,/permanent Super Admin role cannot be assigned/i);assert.match(adminSecurity,/permanent Super Admin account cannot be edited/i)});
check('Only permanent Super Admin can create an Administrator',()=>{assert.match(adminSecurity,/Only the permanent Super Admin can create or assign an Administrator/);assert.match(adminSecurity,/role\.key !== 'admin'/)});
check('Permanent Super Admin account status is protected',()=>{assert.match(adminSecurity,/permanent Super Admin account cannot be suspended or deactivated/);assert.match(securityUi,/Account protected/)});
check('Super Admin can create a separate self mentor profile',()=>{assert.match(adminSecurity,/post\('\/mentors\/self'/);assert.match(adminSecurity,/super_admin_self_mentor_created/);const block=adminSecurity.slice(adminSecurity.indexOf("post('/mentors/self"),adminSecurity.indexOf("post('/mentor-invitations"));assert.doesNotMatch(block,/membership_status|membership_level|staff_memberships/)});
check('Only permanent Super Admin can self-approve mentor profile',()=>{assert.match(adminSecurity,/Only the permanent Super Admin may approve their own mentor profile/);assert.match(adminSecurity,/mentor_self_approved/)});
check('Team UI provides exact module checkboxes and protected Super Admin display',()=>{assert.match(securityUi,/PERMISSION_GROUPS/);assert.match(securityUi,/Exact custom module access/);assert.match(securityUi,/Protected account/);assert.doesNotMatch(securityUi,/prompt\(/)});
check('Admin UI resolves an authorized page before rendering',()=>{assert.match(adminUi,/const resolvedActive=/);assert.match(adminUi,/resolvedActive==='overview'/);assert.doesNotMatch(adminUi,/const view=active==='overview'/)});
check('Dashboard separates staff, mentor and personal membership status',()=>{assert.match(dashboard,/member-access-separation/);assert.match(dashboard,/Staff authority/);assert.match(dashboard,/Personal membership/)});

const failed=checks.filter((item)=>!item.ok);
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'} ${item.name}${item.error?`: ${item.error}`:''}`);
console.log(`\n${checks.length-failed.length}/${checks.length} security regression checks passed.`);
if(failed.length)process.exit(1);
