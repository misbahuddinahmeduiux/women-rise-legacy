WOMEN RISE LEGACY — PHASE 5
UI STABILITY, VISUAL CMS FORMS & RELATIONSHIP FIXES

WHAT PHASE 5 FIXES
- Public header/logo alignment and responsive navigation
- Dedicated clean admin header
- Admin sidebar, buttons, tabs, tables, forms and mobile layouts
- Phase 4 tab overflow and horizontal-scroll issues
- Raw JSON removed from Site Settings
- Raw JSON removed from Website CMS
- Visual fields, switches, lists, nested cards, add/remove and reorder controls
- Dashboard and Members & Mentors PGRST201 relationship ambiguity
- Other membership plan/subscription/payment relationship selectors made explicit
- TypeScript overview count safety fix
- Missing homepage hero image path corrected by Phase 5 SQL

RECOMMENDED UPGRADE ORDER
1. Stop Phase 4.
2. Back up the complete Phase 4 project folder.
3. Copy the Phase 5 upgrade files into the Phase 4 project root and choose Replace.
4. Keep existing client/.env and server/.env.
5. Run 0-SETUP-PHASE-5.bat.
6. Run supabase/PHASE-5-UI-CMS-UPGRADE.sql in Supabase SQL Editor.
7. Run supabase/PHASE-5-VERIFY.sql.
8. Run 2-start-project.bat.
9. Test public header, dashboard, admin, Phase 5 Studio, Settings, Website CMS and mobile widths.

IMPORTANT
- Phase 5 uses the existing /api/phase4 routes and Phase 4 database tables for backward compatibility.
- Technical JSON remains in Supabase, but admins now edit normal fields instead of raw JSON.
- Do not copy or share .env files.
- Rotate any Supabase service-role, Stripe, PayPal, Resend or encryption secret that has ever been exposed.
- Real payment approval still requires Stripe test and PayPal Sandbox transactions plus public HTTPS webhooks.
