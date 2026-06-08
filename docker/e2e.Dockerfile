# syntax=docker/dockerfile:1.7-labs
FROM mcr.microsoft.com/playwright:v1.60.0-noble

ENV BUN_INSTALL=/usr/local/bun
ENV PATH="${BUN_INSTALL}/bin:${PATH}"
ENV CI=1
ENV TURBO_TELEMETRY_DISABLED=1

WORKDIR /work

RUN apt-get update \
  && apt-get install -y --no-install-recommends unzip \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14" \
  && bun --version

# Copy only the workspace manifests first so the dependency-install layer stays
# cached across source-only edits. COPY --parents preserves each file's path
# (e.g. apps/games/redline/package.json), so the Bun workspace graph resolves.
COPY --parents package.json bun.lock apps/*/package.json apps/games/*/package.json packages/*/package.json ./

RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun install --frozen-lockfile

# Then the rest of the repo — this is the layer that busts on source changes.
COPY . .

RUN cd apps/games/scourge-survivors && bun run playwright install chromium
RUN mkdir -p /root/.cache && ln -sfn /ms-playwright /root/.cache/ms-playwright

CMD ["bun", "run", "test:e2e"]
