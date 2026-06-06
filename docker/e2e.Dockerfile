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

COPY . .

RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun install --frozen-lockfile

RUN cd apps/games/scourge-survivors && bun run playwright install chromium
RUN mkdir -p /root/.cache && ln -sfn /ms-playwright /root/.cache/ms-playwright

CMD ["bun", "run", "e2e"]
