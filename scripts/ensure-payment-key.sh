#!/usr/bin/env bash
set -euo pipefail
ENV_PATH="${1:-server/.env}"

[[ -f "$ENV_PATH" ]] || { echo "Environment file not found: $ENV_PATH" >&2; exit 2; }
if grep -Eq '^PAYMENT_CREDENTIALS_ENCRYPTION_KEY=.{32,}$' "$ENV_PATH"; then
  echo 'Payment credential encryption key already exists.'
  exit 0
fi

if command -v openssl >/dev/null 2>&1; then
  KEY="$(openssl rand -hex 32)"
elif command -v node >/dev/null 2>&1; then
  KEY="$(node -e \"process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))\")"
else
  echo 'OpenSSL or Node.js is required to generate the encryption key.' >&2
  exit 3
fi

printf '\nPAYMENT_CREDENTIALS_ENCRYPTION_KEY=%s\n' "$KEY" >> "$ENV_PATH"
echo 'Generated PAYMENT_CREDENTIALS_ENCRYPTION_KEY in server/.env.'
