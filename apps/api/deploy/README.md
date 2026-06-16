# Deadrot API — production deploy

The API (`deadrot-api`, a Bun + Postgres service) runs as a Docker container on an
EC2 host (`shipshit-api`, AL2023), reached over **Tailscale** (public SSH is
firewalled). It is deployed by the **`deploy-api`** job in `.github/workflows/release.yml`
on every `vX.Y.Z` tag — the same release that deploys the Vercel projects. Nothing
auto-deploys on a master push.

## How a release deploys it

1. CI builds the image from `apps/api/Dockerfile` (full monorepo context) and
   `docker save | gzip`s it — no registry.
2. CI joins the tailnet (`tailscale/github-action`, tag `tag:ci`) and `scp`s this
   directory's files + the image tarball to `ec2-user@shipshit-api:~/cloud/docker/`.
3. CI runs `cd ~/cloud && ./docker/deploy-production.sh` on the box, which:
   - `docker load`s the image,
   - renders `.env` from **AWS SSM `/shipshit/production/*`** via the instance role
     (`render-ssm-env.sh`),
   - `docker compose up -d`,
   - waits for `http://127.0.0.1:3004/health/ready`.

The container binds `127.0.0.1:3004`; the host reverse proxy / ALB fronts it for
`api.deadrot.com`.

## Enabling it

The `deploy-api` job is **gated behind repo variable `API_DEPLOY_ENABLED`** and stays
dormant (a release deploys only the Vercel apps) until you set `API_DEPLOY_ENABLED=true`.
Provision everything below first, then flip the variable.

## Required before the first release deploy

These are provisioned **outside** this repo and are not yet in place:

- **GitHub Actions secrets** (repo or `production` environment):
  - `API_DEPLOY_SSH_KEY` — the `shipshit-api-deploy` private key (PEM).
  - `TS_OAUTH_CLIENT_ID` + `TS_OAUTH_SECRET` — Tailscale OAuth client for the CI node.
- **Tailscale ACL** — allow `tag:ci` to SSH `tag:`-of-`shipshit-api` (port 22).
- **AWS SSM** — `/shipshit/production/DATABASE_URL` (RDS) must exist; optionally
  `ALLOWED_ORIGINS`, `CDN_ORIGIN`, `DATABASE_SSL_MODE`. The instance role needs
  `ssm:GetParametersByPath` (+ kms:Decrypt for SecureString).
- **Host firewall / fronting** — the reverse proxy on the box (or ALB) must point
  `api.deadrot.com` at `127.0.0.1:3004`. **The deploy does not change DNS** — the
  container comes up "dark" until `api.deadrot.com` is pointed at this host, so a
  release is safe to run before cutover.

## Manual deploy (from a machine on the tailnet)

```bash
docker build -f apps/api/Dockerfile -t deadrot-api:release .
docker save deadrot-api:release | gzip > apps/api/deploy/deadrot-api-image.tar.gz
scp -i ~/.ssh/shipshit-api-deploy.pem -o IdentitiesOnly=yes apps/api/deploy/* \
  ec2-user@shipshit-api:~/cloud/docker/
ssh -i ~/.ssh/shipshit-api-deploy.pem -o IdentitiesOnly=yes ec2-user@shipshit-api \
  'cd ~/cloud && ./docker/deploy-production.sh'
```
