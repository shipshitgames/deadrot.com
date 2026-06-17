# Deadrot API — production deploy

The Deadrot API (a Bun + Postgres service) runs as the **`api-deadrot-com`** Docker
container on the **`shipshit-api`** EC2 host, **co-located alongside `api.shipshit.games`**
(its `api-shipshit-games` container) — one
box for both, since traffic is minimal. It deploys from the `deploy-api` job in
`.github/workflows/release.yml` on every `vX.Y.Z` tag, next to the Vercel deploy.
Nothing auto-deploys on a master push.

## How a release deploys it

1. CI builds `apps/api/Dockerfile` and pushes to **ghcr** at
   `ghcr.io/shipshitgames/deadrot.com/api:<sha>` (its own package — never collides
   with `ghcr.io/shipshitgames/shipshit.games/api`).
2. CI joins the tailnet as `tag:ci` and reaches the host over **Tailscale SSH** (no
   key in CI; public SSH is firewalled).
3. CI `scp`s **only** `docker-compose.deadrot.yml` + `deploy-deadrot.sh` to
   `~/cloud/docker/` and runs `deploy-deadrot.sh`, which: logs into ghcr, refreshes
   the shared `.env.production` via the host's **canonical `render-ssm-env.sh`**,
   `docker compose up -d` the `api-deadrot-com` container, and waits on
   `http://127.0.0.1:3004/health/ready`.

### Isolation from `api.shipshit.games`

- Separate compose project + container (`api-deadrot-com`) and port (`3004` vs `3003`).
  The deploy **never writes the api.shipshit.games toolkit
  files** (`docker-compose.production.yml`, `deploy-production.sh`, `render-ssm-env.sh`)
  — it only adds `docker-compose.deadrot.yml` + `deploy-deadrot.sh`.
- `DATABASE_URL` comes from the shared `/shipshit/production/DATABASE_URL` (same RDS).
  If deadrot should use a *separate* database, add a distinct SSM param and point the
  compose `env`/`env_file` at it.

## Provisioned / required

- **Tailscale:** org secrets `TAILSCALE_CLIENT_ID` / `TAILSCALE_CLIENT_SECRET`; ACL
  grants `tag:ci → ssh ec2-user@tag:server`; Tailscale SSH enabled on the host. ✅
- **ghcr:** pushed under the deadrot.com repo (`GITHUB_TOKEN`, `packages: write`); the
  host pulls with the same token.
- **SSM:** `/shipshit/production/DATABASE_URL` exists ✅ (instance role reads it).
- **Fronting:** the container binds `127.0.0.1:3004`; the deploy does **not** change
  DNS. `api.deadrot.com` still serves from `52.8.153.188` until you front this host at
  `:3004` and cut over — so a release is safe to run before then.

## Manual deploy (from a tailnet machine)

```bash
image=ghcr.io/shipshitgames/deadrot.com/api
docker build -f apps/api/Dockerfile -t "$image:manual" . && docker push "$image:manual"
scp apps/api/deploy/docker-compose.deadrot.yml apps/api/deploy/deploy-deadrot.sh \
  ec2-user@shipshit-api:~/cloud/docker/
ssh ec2-user@shipshit-api \
  "IMAGE_TAG=manual GHCR_USER=<you> GHCR_TOKEN=<gh-pat> ~/cloud/docker/deploy-deadrot.sh"
```
