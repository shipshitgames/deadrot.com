# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/lore/package.json apps/lore/package.json
COPY apps/games/deadlane/package.json apps/games/deadlane/package.json
COPY apps/games/pactfall/package.json apps/games/pactfall/package.json
COPY apps/games/redline/package.json apps/games/redline/package.json
COPY apps/games/rothulk/package.json apps/games/rothulk/package.json
COPY apps/games/scourge-survivors/package.json apps/games/scourge-survivors/package.json
COPY apps/games/starblight/package.json apps/games/starblight/package.json
COPY apps/games/warline/package.json apps/games/warline/package.json
COPY packages/assets/package.json packages/assets/package.json
COPY packages/catalog/package.json packages/catalog/package.json
COPY packages/game-kit/package.json packages/game-kit/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/warline/package.json packages/warline/package.json
RUN bun install --frozen-lockfile

FROM deps AS builder
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN bun run build

FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3004

COPY --from=deps /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/package.json /app/apps/api/package.json
COPY --from=builder /app/apps/api/dist /app/apps/api/dist

WORKDIR /app/apps/api
USER bun
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3004') + '/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "dist/server.js"]
