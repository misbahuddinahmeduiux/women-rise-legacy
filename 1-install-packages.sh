#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js 22 LTS first."; exit 1; }
[ -f client/.env ] || cp client/.env.example client/.env
[ -f server/.env ] || cp server/.env.example server/.env
npm install
echo "Packages installed. Configure .env files and Supabase, then run ./2-start-project.sh"
