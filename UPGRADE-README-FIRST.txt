WOMEN RISE LEGACY — PHASE 4 TO PHASE 5 UPGRADE

PHASE 5 NAME
UI Stability, Visual CMS Forms & Full Interface Review

WHAT THIS UPGRADE FIXES
- Public header and logo sizing/alignment
- Responsive desktop, tablet and mobile navigation
- Dedicated clean admin header
- Admin sidebar, tabs, buttons, tables, forms and modal layouts
- Phase 4 horizontal tab overflow
- Raw JSON removed from Site Settings
- Raw JSON removed from Website CMS
- Friendly fields, switches, lists, nested cards, add/remove and reorder controls
- Dashboard PGRST201 relationship ambiguity
- Members & Mentors PGRST201 relationship ambiguity
- Other membership/payment/subscription relationship selectors
- TypeScript overview-count safety issue
- Missing homepage hero image path

INSTALLATION
1. Stop the running Phase 4 project.
2. Back up the complete Phase 4 project folder.
3. Extract this ZIP.
4. Copy all extracted files into the Phase 4 project root.
5. Select Replace/Overwrite when Windows asks.
6. Keep the existing client/.env and server/.env files.
7. Run 0-SETUP-PHASE-5.bat.
8. Run supabase/PHASE-5-UI-CMS-UPGRADE.sql in Supabase SQL Editor.
9. Run supabase/PHASE-5-VERIFY.sql.
10. Run 2-start-project.bat.

IMPORTANT
- Do not apply this upgrade to the separate Phase 5 Full package.
- Technical JSON remains in Supabase, but admins edit user-friendly controls.
- Existing /api/phase4 routes remain intentionally for backward compatibility.
- Rotate every secret that has ever appeared in screenshots, messages or repositories.
- Real Stripe/PayPal approval still requires sandbox and public HTTPS webhook testing.
