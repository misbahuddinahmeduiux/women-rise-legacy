#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f client/.env ]] || { echo "client/.env is missing"; exit 2; }
[[ -f server/.env ]] || { echo "server/.env is missing"; exit 3; }
./scripts/ensure-payment-key.sh server/.env
npm install
npm run typecheck
npm run build
printf '\nPhase 4 code setup complete. Run supabase/PHASE-4-DYNAMIC-CMS.sql, optionally run the verify SQL, then start the project.\n'
