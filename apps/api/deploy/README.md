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

## Access model

CI authenticates to the **org Tailscale OAuth client** (`TAILSCALE_CLIENT_ID` /
`TAILSCALE_CLIENT_SECRET`, org-level secrets) as `tag:ci`, then reaches the box over
**Tailscale SSH** — there is **no SSH key in CI**. Public SSH on the host is firewalled.

## Required for the deploy to succeed

- **Tailscale ACL** — grant `tag:ci` → SSH `ec2-user@shipshit-api`, and Tailscale SSH
  must be enabled on the host (`tailscale set --ssh`).
- **AWS SSM** — `/shipshit/production/DATABASE_URL` (RDS) exists ✅; instance role has
  `ssm:GetParametersByPath` + `kms:Decrypt`. `ALLOWED_ORIGINS` / `CDN_ORIGIN` /
  `DATABASE_SSL_MODE` are optional (defaults in `apps/api/src/config.ts`).
- **Fronting** — the deploy binds `127.0.0.1:3004` and **does not change DNS**. The
  container comes up "dark" until `api.deadrot.com` is pointed at `shipshit-api`
  (today it still serves from the separate `52.8.153.188` host), so a release is safe
  to run before cutover.

## Manual deploy (from a machine on the tailnet)

```bash
docker build -f apps/api/Dockerfile -t deadrot-api:release .
docker save deadrot-api:release | gzip > apps/api/deploy/deadrot-api-image.tar.gz
scp -i ~/.ssh/shipshit-api-deploy.pem -o IdentitiesOnly=yes apps/api/deploy/* \
  ec2-user@shipshit-api:~/cloud/docker/
ssh -i ~/.ssh/shipshit-api-deploy.pem -o IdentitiesOnly=yes ec2-user@shipshit-api \
  'cd ~/cloud && ./docker/deploy-production.sh'
```
