#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
npm run validate:phase6
npm run typecheck
npm run build
printf '\nPHASE 6 STEP 1 CODE VALIDATION COMPLETE\n'
printf 'Run supabase/PHASE-6-HOMEPAGE-UI.sql, then supabase/PHASE-6-VERIFY.sql.\n'
