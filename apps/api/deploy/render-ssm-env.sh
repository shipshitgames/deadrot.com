#!/usr/bin/env bash
# Render production env from AWS SSM Parameter Store into ./.env (next to this
# script: ~/cloud/docker/.env). Runs ON the EC2 box; auth is the instance role.
# Each /shipshit/production/<KEY> becomes <KEY>=<value>. The only required value
# is DATABASE_URL (RDS); ALLOWED_ORIGINS / CDN_ORIGIN / DATABASE_SSL_MODE fall
# back to in-app deadrot defaults when absent (see apps/api/src/config.ts).
set -euo pipefail
cd "$(dirname "$0")"

PREFIX="${SSM_PREFIX:-/shipshit/production}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

aws ssm get-parameters-by-path \
  --path "$PREFIX" --recursive --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text \
  | while IFS=$'\t' read -r name value; do
      printf '%s=%s\n' "${name##*/}" "$value"
    done >"$TMP"

if [ ! -s "$TMP" ]; then
  echo "render-ssm-env: no parameters under $PREFIX (instance role missing ssm:GetParametersByPath?)" >&2
  exit 1
fi

install -m 600 "$TMP" .env
echo "render-ssm-env: wrote $(wc -l <.env | tr -d ' ') vars to .env"
