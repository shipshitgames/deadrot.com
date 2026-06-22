#!/usr/bin/env bash
# Runs ON the us-west-1 EC2 host that serves api.deadrot.com (52.8.153.188 /
# i-00e74422e719396c3), co-located with api.shipshit.dev. CI scps this +
# docker-compose.deadrot.yml to ~/cloud/docker and invokes it over Tailscale SSH.
# Deploys ONLY the deadrot-api container and hydrates deadrot's OWN env from its
# dedicated SSM subtree — it never touches the api.shipshit.dev compose, scripts,
# container, or its shared .env.production.
#
# The container is named `deadrot-api` and joins the shared external `shipshit`
# docker network; the host's Caddy proxies api.deadrot.com -> deadrot-api:3004 by
# name. The first run of this cuts the box over from its legacy ECR bootstrap
# container to the ghcr image (it removes + recreates the `deadrot-api` container).
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
CONTAINER="deadrot-api"
NETWORK="shipshit"
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

# The compose file declares the `shipshit` network external; create it if missing
# (idempotent — api.shipshit.dev's deploy may have created it already, or we do).
echo "==> ensure docker network ${NETWORK}"
docker network inspect "${NETWORK}" >/dev/null 2>&1 || docker network create "${NETWORK}" >/dev/null

export IMAGE_TAG
echo "==> pull ${CONTAINER} image (${IMAGE_TAG})"
# Pull BEFORE we touch the live container: a registry hiccup aborts here (set -e)
# with the running container intact, no rollback needed.
docker compose -f "${COMPOSE}" pull

# Note the currently-running image so we can roll back if the new one fails to
# start OR is unhealthy. On the first cutover this is the legacy ECR image; it
# stays cached locally so a rollback can reuse it.
prev_image="$(docker inspect --format '{{.Config.Image}}' "${CONTAINER}" 2>/dev/null || echo "")"
[ -n "${prev_image}" ] && echo "==> current ${CONTAINER} image: ${prev_image}"

# Restore the previously-running image so a bad release does not leave
# api.deadrot.com (Caddy -> deadrot-api:3004) serving 502s. Best-effort but loud;
# invoked on BOTH the start-failure and health-failure paths. ghcr login is still
# active here (logout is deferred to the verdict) so a re-pull can authenticate.
rollback() {
  if [ -z "${prev_image}" ]; then
    echo "ERROR: ${CONTAINER} failed and there is no previous image to roll back to — service is DOWN, manual intervention required" >&2
    return 1
  fi
  echo "==> rolling back ${CONTAINER} to ${prev_image}" >&2
  docker image inspect "${prev_image}" >/dev/null 2>&1 || docker pull "${prev_image}" >/dev/null 2>&1 || true
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
  if DEADROT_IMAGE="${prev_image}" docker compose -f "${COMPOSE}" up -d --force-recreate; then
    echo "rollback to ${prev_image} initiated" >&2
    return 0
  fi
  echo "ERROR: rollback to ${prev_image} FAILED — ${CONTAINER} is DOWN, manual intervention required" >&2
  return 1
}

# The live `deadrot-api` container may not be owned by this compose project (the
# legacy bootstrap created it with `docker run`), so `compose up` would hit a name
# conflict. Remove it first, then recreate from the compose definition. From here
# the old container is gone, so any failure must ATTEMPT ROLLBACK rather than abort
# under `set -e` and leave nothing serving — this is a brief recreate blip on every
# deploy (rm -> up), matching the api.shipshit.dev house pattern.
if docker container inspect "${CONTAINER}" >/dev/null 2>&1; then
  echo "==> removing existing ${CONTAINER} container before recreate"
  docker rm -f "${CONTAINER}" >/dev/null
fi

echo "==> up ${CONTAINER} (${IMAGE_TAG})"
if ! docker compose -f "${COMPOSE}" up -d --force-recreate; then
  echo "ERROR: 'compose up' failed for ${CONTAINER}; recent logs:" >&2
  docker compose -f "${COMPOSE}" logs --tail=80 >&2 || true
  rollback || true
  docker logout ghcr.io >/dev/null 2>&1 || true
  exit 1
fi

echo "==> wait for /health/ready"
healthy=""
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3004/health/ready >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [ -n "${healthy}" ]; then
  echo "${CONTAINER} healthy"
  docker logout ghcr.io >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

echo "${CONTAINER} did not become healthy in time; recent logs:" >&2
docker compose -f "${COMPOSE}" logs --tail=80 >&2 || true
rollback || true
docker logout ghcr.io >/dev/null 2>&1 || true
exit 1
