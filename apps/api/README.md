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
WAITLIST_INGEST_TOKEN=...
WAITLIST_FORWARD_URL=https://optional-sink.example.com/intake
```

## Health

- `GET /health/live` checks process liveness.
- `GET /health/ready` checks RDS readiness.
- `GET /v1/cdn` returns the public Deadrot CDN origin.
- `POST /v1/waitlist` authenticates the web server with
  `WAITLIST_INGEST_TOKEN`, idempotently records a normalized address in Postgres,
  and enqueues optional downstream delivery. It returns success only after the
  transaction commits.

The service creates `waitlist_signups` and `waitlist_outbox` idempotently at
startup. A missing production ingest token degrades `/health/ready`; an invalid
schema/database configuration prevents startup, allowing the deploy rollback to
keep the prior healthy image live.
