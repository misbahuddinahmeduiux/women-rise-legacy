import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
const passes = [];

function pass(message) { passes.push(message); }
function fail(message) { failures.push(message); }
function read(relativePath) { return readFileSync(join(root, relativePath), 'utf8'); }
function sha(relativePath) { return createHash('sha256').update(readFileSync(join(root, relativePath))).digest('hex'); }
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
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? [path, ...walk(path)] : [path];
  });
}

[
  '0-SETUP-PHASE-4.bat',
  'PHASE-4-README-FIRST.txt',
  'supabase/PHASE-4-DYNAMIC-CMS.sql',
  'supabase/PHASE-4-VERIFY.sql',
  'supabase/migrations/007_phase_4_dynamic_cms.sql',
  'server/src/lib/memberships.ts',
  'server/src/routes/memberships.ts',
  'server/src/routes/adminPhase4.ts',
  'server/src/routes/phase4.ts',
  'client/src/pages/Membership.tsx',
  'client/src/pages/AdminPhase4.tsx',
  'client/src/pages/Podcast.tsx',
  'client/src/pages/MentorDashboard.tsx'
].forEach(requireFile);

const packages = ['package.json', 'client/package.json', 'server/package.json'].map((path) => [path, JSON.parse(read(path))]);
for (const [path, pkg] of packages) {
  if (pkg.version === '4.0.0') pass(`${path}: version 4.0.0`);
  else fail(`${path}: expected version 4.0.0, found ${pkg.version}`);
}

if (sha('supabase/PHASE-4-DYNAMIC-CMS.sql') === sha('supabase/migrations/007_phase_4_dynamic_cms.sql')) {
  pass('Phase 4 SQL installer matches migration 007 byte-for-byte');
} else {
  fail('Phase 4 SQL installer does not match migration 007');
}

requireToken('server/src/routes/memberships.ts', "membershipsRouter.post('/checkout'", 'authenticated membership checkout route');
requireToken('server/src/lib/memberships.ts', "membership_status: 'active'", 'automatic activation after verified payment');
requireToken('server/src/lib/memberships.ts', 'assertMentorshipAccess', 'plan-based mentorship access enforcement');
requireToken('server/src/middleware/auth.ts', 'requireDirectoryMembership', 'protected member and mentor directory middleware');
requireToken('server/src/routes/public.ts', 'requireDirectoryMembership', 'directory routes enforce active membership');
requireToken('server/src/routes/payments.ts', 'PAYMENT.SALE.COMPLETED', 'PayPal initial and renewal payment event handling');
requireToken('server/src/routes/payments.ts', 'invoice.payment_failed', 'Stripe failed renewal handling');
requireToken('client/src/pages/AdminPhase4.tsx', 'Membership Plans', 'admin membership plan editor');
requireToken('client/src/pages/AdminPhase4.tsx', 'Website CMS', 'admin website CMS');
requireToken('client/src/pages/AdminPhase4.tsx', 'Podcast', 'admin podcast manager');
requireToken('client/src/pages/Membership.tsx', '/memberships/checkout', 'dynamic membership checkout');

const forbiddenDirectories = new Set(['node_modules', 'dist', '.git']);
const forbiddenFiles = new Set(['.env']);
for (const path of walk(root)) {
  const name = path.split('/').pop();
  if (statSync(path).isDirectory() && forbiddenDirectories.has(name)) fail(`Forbidden generated directory included: ${relative(root, path)}`);
  if (statSync(path).isFile() && forbiddenFiles.has(name)) fail(`Secret environment file included: ${relative(root, path)}`);
}
if (!failures.some((message) => message.startsWith('Forbidden generated') || message.startsWith('Secret environment'))) {
  pass('No .env, node_modules, dist, or .git content is included');
}

const secretPatterns = [
  [/\bsk_live_[A-Za-z0-9_-]{16,}\b/g, 'Stripe live secret key'],
  [/\bsk_test_[A-Za-z0-9_-]{16,}\b/g, 'Stripe test secret key'],
  [/\bE[A-Za-z0-9_-]{80,}\b/g, 'long provider secret'],
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
