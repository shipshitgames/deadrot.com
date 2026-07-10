# Deadrot API — production deploy

The Deadrot API (a Bun + Postgres service) runs as the **`deadrot-api`** Docker
container on the **us-west-1** EC2 host that serves `api.deadrot.com`
(**`52.8.153.188`** / instance `i-00e74422e719396c3`), **co-located alongside
`api.shipshit.dev`** (its `shipshit-api` container) — one box for both, since
traffic is minimal. It deploys from the `deploy-api` job in
`.github/workflows/release.yml` on every `vX.Y.Z` tag, next to the Vercel deploy.
Nothing auto-deploys on a master push.

## Topology

The host runs a shared **`shipshit-caddy`** reverse proxy and a shared external
**`shipshit`** docker network. Caddy terminates TLS and routes by container name
over that network:

```
api.deadrot.com   -> deadrot-api:3004   (this service)
api.shipshit.dev  -> shipshit-api:3003  (sibling, deployed by shipshit.games)
```

So `container_name: deadrot-api` and joining the `shipshit` network are
**load-bearing** — Caddy finds the upstream by that exact name. The container also
publishes `127.0.0.1:3004` purely so the host-side deploy health check can curl it;
public traffic always arrives via Caddy.

> **Historical drift this corrects.** (1) The deploy used to SSH to the tailnet
> node `shipshit-api` (`100.73.69.120` → the **old us-east-1 box** `98.93.179.83`,
> no deadrot DB, decommission-bound); it now targets the us-west-1 host via the
> `TAILSCALE_INSTANCE_API_IP` repo variable. (2) The committed compose named the
> container `api-deadrot-com` with no shared network — Caddy would never have found
> it; it is now `deadrot-api` on the `shipshit` network. (3) The box's live
> container was a legacy **ECR** bootstrap image; the first release cuts it over to
> the repo's **ghcr** image.

## How a release deploys it

1. CI builds `apps/api/Dockerfile` and pushes to **ghcr** at
   `ghcr.io/shipshitgames/deadrot.com/api:<sha>` (its own package — never collides
   with `ghcr.io/shipshitgames/shipshit.games/api`).
2. CI joins the tailnet as `tag:ci`, then gates: **reachability** of
   `${{ vars.TAILSCALE_INSTANCE_API_IP }}`, then **identity** (SSHes in and asserts
   the box reports region `us-west-1`). Either gate failing fails the release —
   it never silently deploys to the wrong/old box.
3. CI reaches the host over **Tailscale SSH** (no key in CI; public SSH is
   firewalled), `mkdir -p ~/cloud/docker`, `scp`s **only** `docker-compose.deadrot.yml`
   + `deploy-deadrot.sh` there, then runs `deploy-deadrot.sh`, which: logs into ghcr,
   renders deadrot's **own** `.env.deadrot.production` from the
   `/shipshit/production/deadrot` SSM subtree (in `AWS_REGION`, default `us-east-1`),
   ensures the `shipshit` network exists, pulls the image, removes the pre-existing
   `deadrot-api` container, `compose up -d` the new one, and waits on
   `http://127.0.0.1:3004/health/ready` — **rolling back to the previous image** if
   it does not become healthy.

### Env / database

- `DATABASE_URL` comes from **`/shipshit/production/deadrot/DATABASE_URL`** (SSM,
  **us-east-1**) → the dedicated **`deadrot-api`** RDS (`deadrot_api` DB,
  us-west-1). It is **not** the shared `/shipshit/production/DATABASE_URL`, which
  points at the `api-shipshit-dev` RDS.
- The deadrot params live in **us-east-1** even though the RDS and host are in
  us-west-1, so `deploy-deadrot.sh` defaults `AWS_REGION=us-east-1`. Pointing it at
  the host's own region would find no `/shipshit/production/deadrot` params and fail.
- `WAITLIST_INGEST_TOKEN` is required in that Deadrot subtree. The deploy validates
  it before touching the live container, and `/health/ready` rejects a production
  process without it. The matching web secret is `WAITLIST_API_TOKEN`.
- `WAITLIST_FORWARD_URL` is optional. Without it, signups remain durable in the
  Deadrot Postgres outbox; adding the sink later drains the backlog.

### Isolation from `api.shipshit.dev`

- Separate container (`deadrot-api` vs `shipshit-api`) and port (`3004` vs `3003`),
  sharing only the `shipshit` network + Caddy. The deploy **never writes the
  api.shipshit.dev toolkit files** (`docker-compose.production.yml`,
  `deploy-production.sh`, `render-ssm-env.sh`, the shared `~/cloud/.env.production`,
  or the Caddyfile) — it only adds `docker-compose.deadrot.yml`, `deploy-deadrot.sh`,
  and its own `~/cloud/docker/.env.deadrot.production`. It declares the `shipshit`
  network `external` so it never owns/destroys it.

## First release = ECR → ghcr cutover

`api.deadrot.com` serves today from the legacy ECR `deadrot-api` container. The
first `v*` tag **removes and recreates** that container from the ghcr image.
Because the container name is reused (Caddy routes by name), this is a
remove-then-recreate, so there is a **brief 502 blip** between `rm` and the new
container becoming reachable — on the first cutover **and on every subsequent
deploy** (same single-container pattern api.shipshit.dev uses). Safeguards:

- **Render-before-swap.** The env is rendered + validated (non-empty SSM,
  `DATABASE_URL` present), the image is pulled, and the network is ensured **before**
  the old container is touched; a bad SSM/IAM/render/pull aborts with the live
  container still running.
- **Rollback.** If the new container **fails to start** or is **not healthy**
  within ~60s, the script redeploys the previously-running image (re-pulling it if
  the daemon GC'd it). If rollback itself fails it exits non-zero loudly — the CI
  deploy step surfaces it, do not let it be swallowed.
- **Gates.** Reachability + `us-west-1` identity must pass first.

## Prerequisites (verified 2026-06-22 — all ✅)

- **Box on tailnet:** the us-west-1 host is the tailnet node `api-shipshit-dev`
  (`100.100.250.30` → `52.8.153.188`), **keyless Tailscale SSH works** for
  `ec2-user` (ACL `tag:ci`/member → `ec2-user`). ✅
- **Repo variable:** `TAILSCALE_INSTANCE_API_IP = 100.100.250.30`. ✅ (Do **not**
  set it to the old `shipshit-api` node `100.73.69.120`.)
- **Tailscale OAuth:** org secrets `TAILSCALE_CLIENT_ID` / `TAILSCALE_CLIENT_SECRET`. ✅
- **ghcr:** pushed under the deadrot.com repo (`GITHUB_TOKEN`, `packages: write`); the
  host pulls with the same token.
- **SSM / IAM:** `/shipshit/production/deadrot/*` exists in **us-east-1** and the
  host's instance role (`shipshit-api-ssm-role`) reads it **with decryption** (8
  params). ✅
- **DNS / fronting:** `api.deadrot.com` → `52.8.153.188`, fronted by Caddy →
  `deadrot-api:3004`. No DNS change in this deploy.

The remaining step is to **merge this PR** so master's `release.yml` carries the
repoint + gates; then a `vX.Y.Z` tag performs the ECR → ghcr cutover.

## Manual deploy (from a tailnet machine)

```bash
HOST_IP=100.100.250.30   # api-shipshit-dev; NOT the old shipshit-api node
image=ghcr.io/shipshitgames/deadrot.com/api
docker build -f apps/api/Dockerfile -t "$image:manual" . && docker push "$image:manual"
ssh "ec2-user@${HOST_IP}" "mkdir -p ~/cloud/docker"
scp apps/api/deploy/docker-compose.deadrot.yml apps/api/deploy/deploy-deadrot.sh \
  "ec2-user@${HOST_IP}:~/cloud/docker/"
ssh "ec2-user@${HOST_IP}" \
  "IMAGE_TAG=manual GHCR_USER=<you> GHCR_TOKEN=<gh-pat> AWS_REGION=us-east-1 \
   ~/cloud/docker/deploy-deadrot.sh"
```
