#!/usr/bin/env bash
# Runs ON the EC2 box. CI ships this dir to ~/cloud/docker and invokes
#   cd ~/cloud && ./docker/deploy-production.sh
# It loads the shipped image tarball, renders env from SSM, brings the API up via
# Compose, and waits for /health/ready. Idempotent — safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker-compose.production.yml"
IMAGE_TAR="deadrot-api-image.tar.gz"

if [ -f "$IMAGE_TAR" ]; then
  echo "==> Loading image from $IMAGE_TAR"
  gunzip -c "$IMAGE_TAR" | docker load
  rm -f "$IMAGE_TAR"
else
  echo "==> No image tarball present; reusing the loaded deadrot-api:release image"
fi

echo "==> Rendering env from SSM"
./render-ssm-env.sh

echo "==> Starting API via Compose"
docker compose -f "$COMPOSE" up -d --remove-orphans

echo "==> Waiting for /health/ready"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3004/health/ready >/dev/null 2>&1; then
    echo "==> API healthy"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "==> API did not become healthy in time; recent logs:" >&2
docker compose -f "$COMPOSE" logs --tail=80 api >&2 || true
exit 1
