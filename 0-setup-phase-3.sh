#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Women Rise Legacy — Phase 3 setup"
if [[ ! -f client/.env ]]; then cp client/.env.example client/.env; fi
if [[ ! -f server/.env ]]; then
  read -r -p "Previous working Phase 2 project path: " oldroot
  if [[ ! -f "$oldroot/server/.env" ]]; then echo "server/.env not found in that folder." >&2; exit 2; fi
  cp "$oldroot/server/.env" server/.env
fi
printf '\n' >> server/.env
grep -q '^APP_URL=' server/.env || echo 'APP_URL=http://localhost:5173' >> server/.env
grep -q '^APP_NAME=' server/.env || echo 'APP_NAME=Women Rise Legacy' >> server/.env
grep -q '^RESEND_API_KEY=' server/.env || echo 'RESEND_API_KEY=' >> server/.env
grep -q '^EMAIL_FROM=' server/.env || echo 'EMAIL_FROM=Women Rise Legacy <noreply@example.com>' >> server/.env
grep -q '^PAYMENT_CREDENTIALS_ENCRYPTION_KEY=.' server/.env || echo "PAYMENT_CREDENTIALS_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> server/.env
npm install
npm run typecheck
npm run build
echo "Code setup complete. Run supabase/PHASE-3-SETUP-ALL.sql and supabase/PHASE-3.1-PAYMENT-GATEWAYS.sql, then ./2-start-project.sh"
