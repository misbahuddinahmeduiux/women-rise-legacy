#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f server/.env ]] || { echo "server/.env is missing." >&2; exit 2; }
if ! grep -q '^PAYMENT_CREDENTIALS_ENCRYPTION_KEY=.' server/.env; then
  printf '\nPAYMENT_CREDENTIALS_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)" >> server/.env
fi
grep -q '^PAYMENT_MODE=' server/.env || echo 'PAYMENT_MODE=demo' >> server/.env
npm install
npm run typecheck
npm run build
echo 'Run supabase/PHASE-3.1-PAYMENT-GATEWAYS.sql, then ./2-start-project.sh'
