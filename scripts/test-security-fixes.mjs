import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const checks=[];
function check(name,fn){try{fn();checks.push({name,ok:true})}catch(error){checks.push({name,ok:false,error:error.message})}}

const migration=read('supabase/migrations/009_security_roles_mentors.sql');
const auth=read('server/src/middleware/auth.ts');
const access=read('server/src/lib/access.ts');
const adminSecurity=read('server/src/routes/adminSecurity.ts');
const admin=read('server/src/routes/admin.ts');
const adminPhase4=read('server/src/routes/adminPhase4.ts');
const phase4=read('server/src/routes/phase4.ts');
const publicRoutes=read('server/src/routes/public.ts');
const app=read('client/src/App.tsx');
const phase5=read('client/src/pages/AdminPhase5.tsx');

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

const failed=checks.filter((item)=>!item.ok);
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'} ${item.name}${item.error?`: ${item.error}`:''}`);
console.log(`\n${checks.length-failed.length}/${checks.length} security regression checks passed.`);
if(failed.length)process.exit(1);
