WOMEN RISE — SECURITY, MENTOR AND TEAM FIX PACKAGE

IMPORTANT
This ZIP contains the corrected code and database migrations. It has NOT modified your remote Supabase project.
Do not apply migration 009 until your backup folder contains backup-verification.txt with:
Verification status: PASSED

SAFE APPLY ORDER
1. Keep the verified backup private and outside Git.
2. Run: npm install
3. Run: npm run test:security
4. Open supabase/migrations/009_security_roles_mentors.sql in Supabase SQL Editor and run it once.
5. Run supabase/009-SECURITY-VERIFY.sql. It must return verification_status = PASSED and must not raise an exception.
6. Run supabase/009-DATA-MIGRATION-REPORT.sql and review legacy mentor records.
7. Deploy the updated server immediately after the migration.
8. Deploy the updated client.
9. Sign in as the existing admin and review:
   - Members
   - Mentors
   - Mentor Invitations
   - Team & Permissions
   - Applications
   - Matches and Sessions
10. Approve legacy mentors only after reviewing their profiles.

WHAT CHANGED
- Member account, mentor profile and staff access are separate.
- Normal users cannot write protected role, mentor, plan or membership fields directly.
- Content Manager and Donation Manager no longer receive full admin authority.
- Admin endpoints use explicit permissions.
- Mentor invitation, onboarding, review and directory publication are separate stages.
- Employee invitations use Team & Permissions and a separate acceptance page.
- Mentors must accept matches before activation.
- Sessions require an active accepted match and approved active mentor.
- Legacy combined role/mentor APIs return HTTP 410.
- Member, mentor, invitation and team lists use server-side pagination.
- Sensitive changes are audit logged.

QUICK VALIDATION
npm run test:security
npm run typecheck
npm run build

If npm dependencies are not installed, run npm install first.

FULL BUILD NOTE
The package passed security regression, syntax and Phase 6 validation checks. Dependency installation was unavailable in the isolated packaging environment, so run npm install, npm run typecheck and npm run build in your connected development environment before deployment.
