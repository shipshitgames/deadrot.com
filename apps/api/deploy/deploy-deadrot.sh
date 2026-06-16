#!/usr/bin/env bash
# Runs ON the shipshit-api EC2 host (CI scps this + docker-compose.deadrot.yml to
# ~/cloud/docker and invokes it over Tailscale SSH). Deploys ONLY the deadrot-api
# container — it reuses the host's canonical render-ssm-env.sh / .env.production and
# never touches the api.shipshit.games compose, scripts, or container.
#
# Required env (exported by the CI deploy step):
#   IMAGE_TAG   — image tag to run (github.sha)
#   GHCR_USER   — ghcr username (github.actor)
#   GHCR_TOKEN  — ghcr token (GITHUB_TOKEN) to pull the private image
set -euo pipefail
cd "$(dirname "$0")" # ~/cloud/docker

: "${IMAGE_TAG:?IMAGE_TAG required}"
: "${GHCR_USER:?GHCR_USER required}"
: "${GHCR_TOKEN:?GHCR_TOKEN required}"

COMPOSE="docker-compose.deadrot.yml"

echo "==> ghcr login"
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin

# Hydrate the shared env (same /shipshit/production source api.shipshit.games uses).
# Use the host's canonical renderer; do not ship our own.
if [ -x ./render-ssm-env.sh ]; then
  echo "==> render env from SSM"
  ./render-ssm-env.sh production
fi
if [ ! -f ../.env.production ]; then
  echo "ERROR: ../.env.production is missing (render-ssm-env.sh did not run?)" >&2
  exit 1
fi

export IMAGE_TAG
echo "==> pull + up deadrot-api (${IMAGE_TAG})"
docker compose -f "${COMPOSE}" pull
docker compose -f "${COMPOSE}" up -d
docker logout ghcr.io >/dev/null 2>&1 || true

echo "==> wait for /health/ready"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3004/health/ready >/dev/null 2>&1; then
    echo "deadrot-api healthy"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "deadrot-api did not become healthy in time; recent logs:" >&2
docker compose -f "${COMPOSE}" logs --tail=80 >&2 || true
exit 1
