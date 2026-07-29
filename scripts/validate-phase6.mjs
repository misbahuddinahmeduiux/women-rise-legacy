import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let passed = 0;
let failed = 0;
const pass = (message) => { passed += 1; console.log(`PASS ${message}`); };
const fail = (message) => { failed += 1; console.error(`FAIL ${message}`); };
const read = (path) => readFileSync(join(root, path), 'utf8');

for (const path of ['package.json','client/package.json','server/package.json']) {
  const pkg = JSON.parse(read(path));
  pkg.version === '6.0.0' ? pass(`${path}: version 6.0.0`) : fail(`${path}: expected version 6.0.0`);
}

const checks = [
  ['client/src/pages/Home.tsx', ['legacy-cta-action-card','legacy-cta-primary','legacy-cta-secondary','/assets/client/women-rise-founder-portrait.webp','/assets/client/women-rise-conference-group.webp']],
  ['client/src/pages/Admin.tsx', ['Operations command centre','admin-overview-hero','Website Studio','admin-stat-card-v2']],
  ['client/src/pages/Dashboard.tsx', ['Personal command centre','member-onboarding-card','Plan-aware shortcuts','member-dashboard-grid-v2']],
  ['client/src/pages/MentorDashboard.tsx', ['Verified mentor workspace','mentor-next-session-card','Active mentees','mentor-impact-callout']],
  ['client/src/pages/AuthPages.tsx', ['auth-experience','professional-auth-card','Secure account access','PasswordField']],
  ['client/src/pages/Membership.tsx', ['billing-cycle-switcher','professional-plan-card','Automatic activation','membership-comparison-note']],
  ['client/src/pages/AdminPhase5.tsx', ['Phase 6','Website, Content & Operations Studio','Phase 6 operational overview']],
  ['client/src/index.css', ['PHASE 6 — COMPLETE PROFESSIONAL UI SYSTEM','.member-command-hero','.mentor-command-hero','.auth-experience','.professional-plan-card','.form-shell','.admin-overview-hero']]
];
for (const [path, tokens] of checks) {
  const source = read(path);
  for (const token of tokens) source.includes(token) ? pass(`${path} includes ${token}`) : fail(`${path} missing ${token}`);
}

const approvedImages = [
  'women-rise-founder-brand-backdrop.webp','women-rise-founder-speaking-beige.webp','women-rise-founder-speaking-black.webp',
  'women-rise-community-dinner.webp','women-rise-conference-group.webp','women-rise-founder-portrait.webp'
];
for (const image of approvedImages) {
  const path = join(root, 'client/public/assets/client', image);
  if (existsSync(path) && statSync(path).size > 10000) pass(`client image present: ${image}`);
  else fail(`client image missing/invalid: ${image}`);
}

const allUiText = checks.map(([path]) => read(path)).join('\n');
for (const token of ['Gemini_Generated_Image','Al Wahid','al-wahid']) {
  allUiText.includes(token) ? fail(`unapproved image reference found: ${token}`) : pass(`no unapproved image reference: ${token}`);
}

for (const path of ['supabase/PHASE-6-HOMEPAGE-UI.sql','supabase/PHASE-6-VERIFY.sql','supabase/migrations/008_phase_6_homepage_ui.sql','0-SETUP-PHASE-6-COMPLETE.bat','PHASE-6-COMPLETE-README-FIRST.txt']) {
  existsSync(join(root,path)) ? pass(`${path} exists`) : fail(`${path} missing`);
}

console.log(`\nPhase 6 complete validation: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
