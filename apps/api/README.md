# Deadrot API

Bun API service for `api.deadrot.com`.

## Environment

```bash
NODE_ENV=production
SERVICE_NAME=deadrot-api
HOST=0.0.0.0
PORT=3004
DATABASE_URL=postgres://...
DATABASE_SSL_MODE=no-verify
CDN_ORIGIN=https://cdn.deadrot.com
ALLOWED_ORIGINS=https://deadrot.com,https://www.deadrot.com
```

## Health

- `GET /health/live` checks process liveness.
- `GET /health/ready` checks RDS readiness.
- `GET /v1/cdn` returns the public Deadrot CDN origin.
