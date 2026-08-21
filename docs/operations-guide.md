# BIELA Technical Operations Guide

## Prerequisites

- Node.js 20 or newer and npm compatible with `package-lock.json`.
- Docker Engine with Docker Compose v2.
- Free local ports 5173, 4000, 4001, 4002, 27017, and 5432.
- An ignored `.env` copied from `.env.example` with local-only values.

## Install and database startup

```bash
cp .env.example .env
npm ci
docker compose up -d
docker compose ps
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status --workspace @biela/ms-autorepuesto
npm run seed:admin
```

Choose new local secrets before startup. The seed is idempotent and never
prints the configured password.

## Application startup

Run each command in a separate terminal:

```bash
npm run dev:users
npm run dev:autorepuesto
npm run dev:gateway
npm run dev:frontend
```

Open `http://localhost:5173`. The browser base URL defaults to the Gateway at
`http://localhost:4000`; only public browser configuration belongs in a
`VITE_*` variable.

## Health and API documentation

```bash
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/api/system/health
curl -fsS http://localhost:4001/health
curl -fsS http://localhost:4002/health
```

Swagger is available at `/docs` on ports 4000, 4001, and 4002. The Gateway
Swagger is the public integration surface.

## Logs and graceful restart

Application logs remain in their terminal. Database logs are available with:

```bash
docker compose logs --tail=200 mongodb postgres
```

Stop a foreground Nest/Vite process with `Ctrl+C`, wait for it to exit, and
start the same workspace command again. Do not kill database containers or
delete volumes as part of an ordinary application restart.

## Port troubleshooting

```bash
ss -ltnp | grep -E ':4000|:4001|:4002|:5173'
```

`EADDRINUSE` means another process already owns the port. Identify it before
stopping anything. When the listed processes are known disposable BIELA dev
instances, an optional cleanup is:

```bash
fuser -k 4000/tcp 4001/tcp 4002/tcp 5173/tcp
```

Never place this command in an automatic release script and never use it
without checking the process owners.

## Verification commands

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
```

E2E tests require healthy local MongoDB and PostgreSQL. Prisma 6.19.3 is the
supported major version; do not accept a Prisma 7 upgrade notification as part
of routine operations.

## Shutdown

Stop the four foreground applications with `Ctrl+C`. To stop database
containers while retaining named-volume data:

```bash
docker compose down
```

Do not add `-v` unless a human explicitly intends to delete local database
volumes and has a verified backup.
