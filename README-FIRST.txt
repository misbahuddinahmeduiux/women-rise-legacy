WOMEN RISE LEGACY — PHASE 2 COMPLETE PACKAGE
============================================

THIS ZIP CONTAINS PHASE 1 + PHASE 2 SOURCE CODE.
It is designed to use the SAME Supabase project already configured for Phase 1.

SAFE INSTALL ORDER
------------------
1. Keep your working Phase 1 folder as a backup. Do not delete it.
2. Extract this ZIP into a NEW folder.
3. Copy these two private files from your working Phase 1 folder into the new folder:
   - client\.env
   - server\.env
4. Double-click 1-install-packages.bat
5. In your existing Supabase project, open SQL Editor.
6. Open supabase\PHASE-2-SETUP-ALL.sql, copy all SQL, paste it into Supabase, and click Run.
7. Optional: run supabase\PHASE-2-VERIFY.sql to confirm the new tables and demo records.
8. Double-click 2-start-project.bat
9. Sign out and sign in again so the extended profile fields are loaded.
10. Open http://localhost:5173/dashboard
11. Open http://localhost:5173/admin

DO NOT
------
- Do not paste a Supabase secret key into client\.env.
- Do not share server\.env or screenshots containing secret keys.
- Do not run PHASE-1-SETUP-ALL.sql again on your working database.
- Do not overwrite your only working Phase 1 copy before testing Phase 2.

DATABASE
--------
Run only:
  supabase\PHASE-2-SETUP-ALL.sql

The Phase 2 SQL extends existing tables, creates Network modules, adds branded demo records,
and keeps Phase 1 Foundation data intact.

START COMMAND
-------------
After first-time setup, daily startup is only:
  2-start-project.bat

WEBSITE
-------
Frontend: http://localhost:5173
API:      http://localhost:5050/api/health

CONTINUING IN A NEW CHAT
------------------------
Upload PROJECT-HANDOFF.md and CURRENT-PROGRESS.md and say:
"Read these handoff files and continue Women Rise Legacy from the next pending task."

PHASE 2.1 UI NOTE
This package includes the responsive homepage slider, official founder cutout image, Donate-button fix, and laptop/tablet/mobile navigation refinements. See UI-FIX-README.txt.
