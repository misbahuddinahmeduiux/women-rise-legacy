import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const passes = [];

function pass(message) { passes.push(message); }
function fail(message) { failures.push(message); }
function read(relativePath) { return readFileSync(join(root, relativePath), 'utf8'); }
function requireFile(relativePath) {
  if (existsSync(join(root, relativePath))) pass(`Required file exists: ${relativePath}`);
  else fail(`Missing required file: ${relativePath}`);
}
function requireToken(relativePath, token, label = token) {
  const path = join(root, relativePath);
  if (!existsSync(path)) return fail(`Cannot inspect missing file: ${relativePath}`);
  if (readFileSync(path, 'utf8').includes(token)) pass(`${relativePath}: ${label}`);
  else fail(`${relativePath} is missing ${label}`);
}
function forbidToken(relativePath, token, label = token) {
  const path = join(root, relativePath);
  if (!existsSync(path)) return fail(`Cannot inspect missing file: ${relativePath}`);
  if (!readFileSync(path, 'utf8').includes(token)) pass(`${relativePath}: no ${label}`);
  else fail(`${relativePath} still contains ${label}`);
}
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? [path, ...walk(path)] : [path];
  });
}

[
  '0-SETUP-PHASE-5.bat',
  'supabase/PHASE-5-UI-CMS-UPGRADE.sql',
  'supabase/PHASE-5-VERIFY.sql',
  'client/src/components/StructuredEditor.tsx',
  'client/src/components/Layout.tsx',
  'client/src/pages/AdminPhase5.tsx',
  'client/src/pages/Admin.tsx',
  'server/src/routes/dashboard.ts',
  'server/src/routes/adminPhase4.ts'
].forEach(requireFile);

const packages = ['package.json', 'client/package.json', 'server/package.json'].map((path) => [path, JSON.parse(read(path))]);
for (const [path, pkg] of packages) {
  if (pkg.version === '5.0.0') pass(`${path}: version 5.0.0`);
  else fail(`${path}: expected version 5.0.0, found ${pkg.version}`);
}

requireToken('client/src/pages/Admin.tsx', 'StructuredEditor', 'visual site-settings editor');
requireToken('client/src/pages/AdminPhase5.tsx', 'Website content editor', 'visual website CMS');
forbidToken('client/src/pages/Admin.tsx', "JSON.parse(String(fd.get('value')))", 'raw JSON settings parser');
forbidToken('client/src/pages/AdminPhase5.tsx', '<textarea rows={24}', 'raw JSON CMS textarea');
requireToken('client/src/components/Layout.tsx', 'admin-site-header', 'dedicated admin header');
requireToken('client/src/components/Layout.tsx', '<details className="nav-dropdown">', 'responsive accessible dropdown navigation');
requireToken('client/src/index.css', 'PHASE 5 — UI STABILITY', 'Phase 5 responsive CSS overrides');
requireToken('server/src/routes/dashboard.ts', 'membership_plans!profiles_membership_plan_id_fkey', 'explicit dashboard membership relationship');
requireToken('server/src/routes/adminPhase4.ts', 'membership_subscriptions!membership_subscriptions_user_id_fkey', 'explicit admin member subscription relationship');
requireToken('server/src/routes/adminPhase4.ts', 'results[index]?.count', 'safe overview count access');
forbidToken('supabase/PHASE-5-UI-CMS-UPGRADE.sql', '/assets/brand/hero-community.webp\'::text', 'new invalid hero path assignment');

const forbiddenDirectories = new Set(['node_modules', 'dist', '.git']);
const forbiddenFiles = new Set(['.env']);
for (const path of walk(root)) {
  const name = path.split('/').pop();
  if (statSync(path).isDirectory() && forbiddenDirectories.has(name)) fail(`Forbidden generated directory included: ${relative(root, path)}`);
  if (statSync(path).isFile() && forbiddenFiles.has(name)) fail(`Secret environment file included: ${relative(root, path)}`);
}
if (!failures.some((message) => message.startsWith('Forbidden generated') || message.startsWith('Secret environment'))) pass('No .env, node_modules, dist, or .git content is included');

const secretPatterns = [
  [/\bsk_live_[A-Za-z0-9_-]{16,}\b/g, 'Stripe live secret key'],
  [/\bsk_test_[A-Za-z0-9_-]{16,}\b/g, 'Stripe test secret key'],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, 'JWT token']
];
const scannableExtensions = /\.(?:ts|tsx|js|mjs|json|sql|md|txt|bat|sh|yml|yaml|example)$/i;
for (const path of walk(root)) {
  if (!statSync(path).isFile() || !scannableExtensions.test(path)) continue;
  const content = readFileSync(path, 'utf8');
  for (const [pattern, label] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) fail(`Possible ${label} found in ${relative(root, path)}`);
  }
}
if (!failures.some((message) => message.startsWith('Possible '))) pass('No obvious live credentials or JWTs found in source package');

for (const message of passes) console.log(`PASS  ${message}`);
for (const message of failures) console.error(`FAIL  ${message}`);
console.log(`\n${passes.length} passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
