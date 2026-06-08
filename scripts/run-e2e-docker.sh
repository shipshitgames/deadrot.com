#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${E2E_DOCKER_IMAGE:-deadrotcom-e2e:local}"
ARTIFACT_DIR="${E2E_ARTIFACT_DIR:-${ROOT_DIR}/.artifacts/e2e}"

mkdir -p "${ARTIFACT_DIR}"

# CI builds the image once via buildx (with a GHA layer cache) and sets
# E2E_SKIP_BUILD=1 so this script just runs the prebuilt image. Locally the
# script builds it itself.
if [[ "${E2E_SKIP_BUILD:-0}" != "1" ]]; then
  docker build \
    --file "${ROOT_DIR}/docker/e2e.Dockerfile" \
    --tag "${IMAGE_NAME}" \
    "${ROOT_DIR}"
fi

docker run --rm \
  --env CI=1 \
  --env TURBO_TELEMETRY_DISABLED=1 \
  --env E2E_GAME_SLUGS="${E2E_GAME_SLUGS:-}" \
  --env PLAYWRIGHT_HTML_REPORT=/work/.artifacts/e2e/playwright-report \
  --env PLAYWRIGHT_TEST_OUTPUT_DIR=/work/.artifacts/e2e/test-results \
  --volume "${ARTIFACT_DIR}:/work/.artifacts/e2e" \
  "${IMAGE_NAME}"
