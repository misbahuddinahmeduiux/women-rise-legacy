# Final Super Admin, Employee Permissions and UI Update

## Final rules implemented

- One permanent Super Admin record only.
- The permanent Super Admin cannot be duplicated, reassigned, edited, suspended, deactivated or replaced from Team & Permissions.
- Only the permanent Super Admin can create or assign an Administrator role.
- Admins and employees can use role defaults or exact custom module permissions.
- Exact custom access replaces role defaults instead of accidentally adding permissions.
- Staff authority, mentor profile and personal paid membership remain independent.
- The permanent Super Admin can create a separate mentor profile for themselves.
- The permanent Super Admin can self-approve a completed, submitted mentor profile, with an audit record.
- Creating a staff account never creates mentor or paid membership status.
- Creating a mentor never creates staff or paid membership status.

## UI corrections included

- Rebuilt Team & Permissions with responsive cards, filters, role selection and grouped module permission checkboxes.
- Added a review-and-confirm step before employee access changes are saved.
- Added permanent Super Admin protection labels and disabled unsafe actions.
- Clearly renamed membership controls as Personal membership.
- Added separate staff, mentor and personal membership status to the dashboard.
- Added mentor invitation, self-mentor, review and directory visibility interfaces.
- Added consistent modals, status badges, loading/empty/error states and responsive tables/cards.
- Retained the dashboard conditional-hook crash fix.

## Deployment order

1. Keep the verified pre-change backup private.
2. Run `supabase/migrations/011_single_super_admin_and_permission_overrides.sql` once in Supabase SQL Editor.
3. Run `supabase/011-SUPER-ADMIN-PERMISSIONS-VERIFY.sql` and verify:
   - `permission_mode` exists.
   - Super Admin record count is exactly `1`.
   - `idx_staff_memberships_single_super_admin` exists.
4. Copy this patch into the GitHub-connected original project and replace matching files.
5. Run typecheck, build and security checks.
6. Commit and push to `main`.
7. Wait for Railway and Vercel deployments to complete.
8. Hard refresh the live site and perform the smoke tests below.

## Local validation commands

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:security
```

Expected static security result:

```text
27/27 security regression checks passed.
```

## Production smoke tests

- Super Admin account displays as Permanent and Account protected.
- Super Admin personal membership is shown separately and is not inferred from staff authority.
- Super Admin can add themselves as a mentor, complete onboarding and self-approve after submission.
- Super Admin can add an Administrator.
- Non-Super-Admin staff cannot create an Administrator.
- Employee exact custom access shows only selected modules.
- A user without a permission gets `403` from the backend even when opening a URL manually.
- Mentor invitation does not create staff access or paid membership.
- Staff invitation does not create mentor status or paid membership.
- Mobile and desktop Team & Permissions screens remain usable.

## Important

Do not rerun migrations 009 or 010. Migration 011 is the only new database migration in this patch.
