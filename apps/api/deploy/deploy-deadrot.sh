#!/usr/bin/env bash
# Runs ON the us-west-1 EC2 host that serves api.deadrot.com (52.8.153.188 /
# i-00e74422e719396c3), co-located with api.shipshit.dev. CI scps this +
# docker-compose.deadrot.yml to ~/cloud/docker and invokes it over Tailscale SSH.
# Deploys ONLY the api-deadrot-com container and hydrates deadrot's OWN env from
# its dedicated SSM subtree — it never touches the api.shipshit.dev compose,
# scripts, container, or its shared .env.production.
#
# Required env (exported by the CI deploy step):
#   IMAGE_TAG   — image tag to run (github.sha)
#   GHCR_USER   — ghcr username (github.actor)
#   GHCR_TOKEN  — ghcr token (GITHUB_TOKEN) to pull the private image
# Optional env:
#   AWS_REGION       — region holding the deadrot SSM subtree (default us-east-1;
#                      the deadrot params live in us-east-1, NOT the host's region)
#   DEADROT_SSM_PATH — SSM path prefix for deadrot params
#                      (default /shipshit/production/deadrot)
set -euo pipefail
cd "$(dirname "$0")" # ~/cloud/docker

: "${IMAGE_TAG:?IMAGE_TAG required}"
: "${GHCR_USER:?GHCR_USER required}"
: "${GHCR_TOKEN:?GHCR_TOKEN required}"

COMPOSE="docker-compose.deadrot.yml"
ENV_FILE=".env.deadrot.production"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_REGION
export AWS_DEFAULT_REGION="${AWS_REGION}"
DEADROT_SSM_PATH="${DEADROT_SSM_PATH:-/shipshit/production/deadrot}"

echo "==> ghcr login"
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin

# Hydrate deadrot's OWN env from its dedicated SSM subtree. We deliberately do
# NOT reuse the host's shared .env.production (rendered from /shipshit/production):
# that tree's DATABASE_URL points at the api-shipshit-dev RDS, and its leaf keys
# (DATABASE_URL/PORT/NODE_ENV) collide with this subtree. The deadrot subtree's
# DATABASE_URL points at the deadrot-api RDS. Keys are the SSM leaf names; values
# must be single-line. Written into ~/cloud/docker (never ~/cloud/.env.production).
echo "==> render ${ENV_FILE} from SSM ${DEADROT_SSM_PATH} (${AWS_REGION})"
rows="$(
  aws ssm get-parameters-by-path \
    --path "${DEADROT_SSM_PATH}" \
    --recursive \
    --with-decryption \
    --region "${AWS_REGION}" \
    --query 'Parameters[].[Name,Value]' \
    --output text
)"
if [ -z "${rows}" ] || [ "${rows}" = "None" ]; then
  echo "ERROR: no SSM parameters found under ${DEADROT_SSM_PATH} in ${AWS_REGION}" >&2
  exit 1
fi

umask 077
tmp="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
trap 'rm -f "${tmp}"' EXIT
{
  printf '# Generated from AWS SSM %s (%s) — do not edit by hand.\n\n' "${DEADROT_SSM_PATH}" "${AWS_REGION}"
  while IFS=$'\t' read -r name value; do
    [ -n "${name}" ] || continue
    # A multiline parameter value breaks the tab-separated framing above: its
    # continuation lines arrive as rows whose first field is not an SSM path.
    case "${name}" in
      /*) ;;
      *)
        echo "ERROR: multiline SSM value detected (fragment: ${name%%=*}); store single-line values" >&2
        exit 1
        ;;
    esac
    printf '%s=%s\n' "${name##*/}" "${value}"
  done <<< "${rows}"
} > "${tmp}"
chmod 600 "${tmp}"

if ! grep -q '^DATABASE_URL=' "${tmp}"; then
  echo "ERROR: no DATABASE_URL rendered from ${DEADROT_SSM_PATH} in ${AWS_REGION}" >&2
  exit 1
fi
mv "${tmp}" "${ENV_FILE}"
trap - EXIT

export IMAGE_TAG
echo "==> pull + up api-deadrot-com (${IMAGE_TAG})"
docker compose -f "${COMPOSE}" pull
docker compose -f "${COMPOSE}" up -d
docker logout ghcr.io >/dev/null 2>&1 || true

echo "==> wait for /health/ready"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3004/health/ready >/dev/null 2>&1; then
    echo "api-deadrot-com healthy"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "api-deadrot-com did not become healthy in time; recent logs:" >&2
docker compose -f "${COMPOSE}" logs --tail=80 >&2 || true
exit 1
