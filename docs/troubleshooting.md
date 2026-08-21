# BIELA Troubleshooting Guide

Start with `docker compose ps`, the aggregate health endpoint, and the terminal
logs. Avoid deleting data to diagnose availability.

## Port already in use

For `EADDRINUSE` on 4000, 4001, 4002, or 5173:

```bash
ss -ltnp | grep -E ':4000|:4001|:4002|:5173'
```

Stop the known duplicate BIELA process gracefully. Only after confirming every
owner, optional local cleanup is:

```bash
fuser -k 4000/tcp 4001/tcp 4002/tcp 5173/tcp
```

Do not run it automatically or against unknown processes.

## Service availability

| Symptom | Check | Action |
| --- | --- | --- |
| Gateway unavailable | `curl -fsS localhost:4000/health` | Start `npm run dev:gateway`; verify `MS_USERS_URL` and `MS_AUTOREPUESTO_URL` |
| `ms-users` unavailable | `curl -fsS localhost:4001/health` | Check MongoDB and `MS_USERS_MONGO_URI`; start `npm run dev:users` |
| `ms-autorepuesto` unavailable | `curl -fsS localhost:4002/health` | Check PostgreSQL, migrations, and `DATABASE_URL`; start `npm run dev:autorepuesto` |
| Frontend unavailable | open `http://localhost:5173` | Start `npm run dev:frontend`; verify `VITE_API_BASE_URL` points to port 4000 |

A Gateway 502 usually means an upstream connection or timeout failure. An
autorepuesto 503 during token validation means `ms-users` is unavailable; it is
not the same as invalid credentials.

## Databases and migrations

```bash
docker compose ps
docker compose logs --tail=200 mongodb postgres
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status --workspace @biela/ms-autorepuesto
```

If Prisma reports a pending migration, verify the target `DATABASE_URL`, then
deploy. Never edit historical migration SQL, reset a shared database, or delete
volumes as a shortcut.

## HTTP and UI messages

- **401**: invalid/expired token or inactive User. Sign in again. An invalid
  password is a 401; an unavailable service is 502/503.
- **403**: valid identity without the required backend permission. Review Role
  assignment; do not broaden access blindly.
- **409**: business conflict such as duplicate posting, insufficient stock or
  Cash, exceeded settlement/return eligibility, or stale state. Refresh and
  inspect current data before retrying.
- **400**: request validation failed; correct the fields shown.
- **404**: the addressed record does not exist.

## Browser refresh and local URL

Use `http://localhost:5173`. Deep-link refresh is supported by the Vite dev
server. A temporary Gateway/users outage during identity restoration preserves
the stored token and offers retry/logout; do not clear application data unless
you intentionally want to sign out.

## Vite chunk warning

The production build currently reports a main JavaScript chunk slightly above
500 kB minified. Build success and local usability are unaffected. It is a
known non-blocking optimization opportunity, not a reason to alter business
modules during release closure.
