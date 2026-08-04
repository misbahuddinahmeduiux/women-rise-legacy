# Work Package A — Stability, Staff Access and Safe Release

## Included fixes

- Browser tab return no longer replaces the current page with a blocking full-screen loader.
- Access lookups refresh quietly in the background and temporary API failures preserve the mounted page.
- Employee/Admin modal is top-aligned, internally scrollable, keyboard-managed and full-screen on mobile.
- Existing employees cannot be moved back into the `invited` state through normal editing.
- Staff status transitions are validated on the server.
- Account/staff role/permission changes rotate a server-managed auth version.
- The client refreshes a stale session once and retries the protected API request.
- Suspended/deactivated member accounts are banned from obtaining new Auth sessions until reactivated.
- A sanitized source-release generator excludes secrets, backups, Git history, dependencies and generated builds.

## Database migration

Apply once:

`supabase/migrations/012_auth_version_and_session_invalidation.sql`

Verify with:

`supabase/012-AUTH-SESSION-VERIFY.sql`

Do not run the rollback file during normal deployment.

## Validation

- TypeScript typecheck: passed
- Server production build: passed
- Security regression suite: 33/33 passed
- Sanitized release generator: passed
- Client Vite bundling must be run on the Windows project after applying the patch because the uploaded archive contains Windows-native dependencies that cannot execute in the Linux review environment.

## Live acceptance checks

1. Open Dashboard/Admin, switch browser tabs, return and confirm the same page remains visible without a blocking loader.
2. Open Add Admin/Employee on a short laptop viewport and on mobile; header and Save/Review actions must remain available.
3. Confirm an active/suspended/deactivated employee cannot be changed to `invited`.
4. Change an employee's permissions while that employee is signed in; their next protected request should refresh once and use the new access.
5. Suspend a member account; new login/refresh should be blocked until reactivation.
6. Run `17-create-sanitized-release.bat` and inspect the generated manifest before sharing a source archive.
