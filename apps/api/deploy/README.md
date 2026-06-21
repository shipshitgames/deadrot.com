# Deadrot API — production deploy

The Deadrot API (a Bun + Postgres service) runs as the **`api-deadrot-com`** Docker
container on the **us-west-1** EC2 host that serves `api.deadrot.com`
(**`52.8.153.188`** / instance `i-00e74422e719396c3`), **co-located alongside
`api.shipshit.dev`** (its `api-shipshit-dev` container) — one box for both, since
traffic is minimal. It deploys from the `deploy-api` job in
`.github/workflows/release.yml` on every `vX.Y.Z` tag, next to the Vercel deploy.
Nothing auto-deploys on a master push.

> **Heads up — historical drift.** The deploy used to target the tailnet node
> `shipshit-api` (`100.73.69.120`), which resolves to the **old us-east-1 box**
> (`98.93.179.83`) that has **no deadrot DB access** and is slated for
> decommission. The target is now the us-west-1 host above, addressed by its
> Tailscale IP via the `TAILSCALE_INSTANCE_API_IP` repo variable. See
> **Prerequisites** — the cutover is gated on that box joining the tailnet.

## How a release deploys it

1. CI builds `apps/api/Dockerfile` and pushes to **ghcr** at
   `ghcr.io/shipshitgames/deadrot.com/api:<sha>` (its own package — never collides
   with `ghcr.io/shipshitgames/shipshit.games/api`).
2. CI joins the tailnet as `tag:ci`, then **gates on reachability** of
   `${{ vars.TAILSCALE_INSTANCE_API_IP }}` — if that variable is unset or the host
   is unreachable, the release **fails** instead of deploying to the wrong box.
3. CI reaches the host over **Tailscale SSH** (no key in CI; public SSH is
   firewalled) and `scp`s **only** `docker-compose.deadrot.yml` + `deploy-deadrot.sh`
   to `~/cloud/docker/`, then runs `deploy-deadrot.sh`, which: logs into ghcr,
   renders deadrot's **own** `.env.deadrot.production` from the
   `/shipshit/production/deadrot` SSM subtree (in `AWS_REGION`, default
   `us-east-1`), `docker compose up -d` the `api-deadrot-com` container, and waits
   on `http://127.0.0.1:3004/health/ready`.

### Env / database

- `DATABASE_URL` comes from **`/shipshit/production/deadrot/DATABASE_URL`** (SSM,
  **us-east-1**) → the dedicated **`deadrot-api`** RDS (`deadrot_api` DB,
  us-west-1). It is **not** the shared `/shipshit/production/DATABASE_URL`, which
  points at the `api-shipshit-dev` RDS.
- The deadrot params live in **us-east-1** even though the RDS and host are in
  us-west-1, so `deploy-deadrot.sh` defaults `AWS_REGION=us-east-1` (overridable
  via the `AWS_REGION` env / repo variable). Pointing it at the host's own region
  would find no `/shipshit/production/deadrot` params and fail.

### Isolation from `api.shipshit.dev`

- Separate compose project + container (`api-deadrot-com`) and port (`3004` vs `3003`).
  The deploy **never writes the api.shipshit.dev toolkit files**
  (`docker-compose.production.yml`, `deploy-production.sh`, `render-ssm-env.sh`, or
  the shared `~/cloud/.env.production`) — it only adds `docker-compose.deadrot.yml`,
  `deploy-deadrot.sh`, and its own `~/cloud/docker/.env.deadrot.production`.

## First release / regression risk

`api.deadrot.com` is **hand-deployed and healthy today**; the first `v*` tag after
this change runs `deploy-deadrot.sh`, which re-renders the env and
`docker compose up -d` (replacing the running container). Two things make that
safe to attempt:

- **Render-before-swap.** `deploy-deadrot.sh` renders + validates the env
  (non-empty SSM result, `DATABASE_URL` present) **before** it pulls or replaces
  the container. A missing IAM grant / empty SSM result aborts the script with the
  live container untouched — it does not half-deploy.
- **Identity + reachability gates.** The workflow refuses to deploy unless the
  target is reachable **and** reports region `us-west-1` (so a misconfigured
  variable pointing at the old us-east-1 box fails closed).

The one load-bearing unknown is whether **this** host's instance role can read the
us-east-1 deadrot subtree. Dry-run it on the host (under the instance role) before
cutting the first tag:

```bash
aws ssm get-parameters-by-path --path /shipshit/production/deadrot \
  --recursive --with-decryption --region us-east-1 --query 'length(Parameters)'
```

## Prerequisites

- **Tailscale — cutover gate (currently OUTSTANDING):** the us-west-1 host must be
  **joined to the tailnet** with **Tailscale SSH enabled** and an ACL granting
  `tag:ci → ssh ec2-user@<that node>`, and the repo variable
  **`TAILSCALE_INSTANCE_API_IP`** set to its `100.x` Tailscale IP. As of this
  change the box is **not** a tailnet peer, so the deploy's reachability gate fails
  by design until it joins. (If the box only supports key-based SSH — as
  `shipshit.games` uses for the same host via `EC2_SSH_KEY`/`EC2_USER` — switch
  this job to that transport instead of keyless Tailscale SSH.)
- **Tailscale OAuth:** org secrets `TAILSCALE_CLIENT_ID` / `TAILSCALE_CLIENT_SECRET`. ✅
- **ghcr:** pushed under the deadrot.com repo (`GITHUB_TOKEN`, `packages: write`); the
  host pulls with the same token.
- **SSM / IAM:** `/shipshit/production/deadrot/*` exists in **us-east-1** ✅; the
  host's **instance role** must allow `ssm:GetParametersByPath` (+ `kms:Decrypt`)
  on that us-east-1 subtree. Verify on the host before the first release.
- **Fronting:** the container binds `127.0.0.1:3004`; the deploy does **not** change
  DNS. `api.deadrot.com` already serves from this host at `:3004`.

## Manual deploy (from a tailnet machine)

```bash
HOST_IP=<us-west-1 host Tailscale IP>   # NOT the old shipshit-api node
image=ghcr.io/shipshitgames/deadrot.com/api
docker build -f apps/api/Dockerfile -t "$image:manual" . && docker push "$image:manual"
scp apps/api/deploy/docker-compose.deadrot.yml apps/api/deploy/deploy-deadrot.sh \
  "ec2-user@${HOST_IP}:~/cloud/docker/"
ssh "ec2-user@${HOST_IP}" \
  "IMAGE_TAG=manual GHCR_USER=<you> GHCR_TOKEN=<gh-pat> AWS_REGION=us-east-1 \
   ~/cloud/docker/deploy-deadrot.sh"
```
