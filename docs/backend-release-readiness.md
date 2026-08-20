# BIELA Backend Release Readiness

Backend Phase 9 verifies the complete traditional ERP backend implemented by
Phases 1–8. Phase 9 adds no business module and no database migration. The
release boundary is suitable for a future React client consuming only the API
Gateway.

## Architecture and ports

```text
React client → API Gateway :4000
                 ├─ HTTP → ms-users :4001 → MongoDB :27017
                 └─ HTTP → ms-autorepuesto :4002 → PostgreSQL :5432
```

`ms-users` exclusively owns users, roles, permissions, password hashes, JWT
authentication, and MongoDB. `ms-autorepuesto` exclusively owns operational ERP
data, PostgreSQL, Prisma, and migrations. The Gateway owns no database, ORM,
repository, balance, stock, Cash, or settlement calculation.

## Environment and dependencies

Copy `.env.example` to ignored `.env` and replace every example secret. Required
configuration covers MongoDB (`MS_USERS_MONGO_URI`), PostgreSQL (`DATABASE_URL`),
JWT (`JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`), seed administrator values,
service ports/URLs, `UPSTREAM_TIMEOUT_MS`, and `CORS_ORIGINS`. Docker Compose
provides MongoDB 7 and PostgreSQL 16 with health checks.

```bash
npm ci
docker compose up -d
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status --workspace @biela/ms-autorepuesto
npm run seed:admin
```

The administrator seed is idempotent: it maintains one `administrator` role,
replaces that role's permission list with the current controlled set, and
reactivates/reassigns the configured administrator without printing a password.

## Migrations

There are 13 ordered, additive PostgreSQL migrations through Phase 8. A fresh
database must apply all 13 from zero. The migration history reproducibly creates
`pg_trgm`, Product code/name GIN trigram indexes, document/payment sequences,
foreign keys, unique commercial effects, one OPEN Cash Session per register,
non-negative Inventory, positive quantities, exact money checks, and controlled
Payment/Cash reference shapes. Historical migrations must never be rewritten or
squashed.

## Startup, health, and Swagger

Start each service in its own terminal:

```bash
npm run dev:users
npm run dev:autorepuesto
npm run dev:gateway
```

Swagger is live at:

- Gateway: `http://localhost:4000/docs`
- ms-users: `http://localhost:4001/docs`
- ms-autorepuesto: `http://localhost:4002/docs`

`GET /api/system/health` through the Gateway is healthy only when both services
and their owned databases are available. An unavailable downstream is reported
as `degraded`; the Gateway process health remains separately visible at
`GET /health`.

## Verification

The release gate is:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status --workspace @biela/ms-autorepuesto
npm run lint
npm test
npm run test:e2e
npm run build
npm audit --omit=dev
git diff --check
```

Phase 9 observed 14 passing unit suites (37 tests), 19 passing E2E suites (133
tests), and four passing concurrency suites (21 scenarios), with zero failures.
The concurrency suites are part of the E2E total. They cover purchasing, sales,
Cash/Payments, and cross-domain commercial races. Transaction retry is bounded
to three attempts for Prisma `P2034` and PostgreSQL `40001`/`40P01` surfaced
through Prisma. Financial lock order is document, optional Return, optional
Payment, then CashSession.

## Newman release flow

Historical Phase collections remain unchanged. The consolidated collection is:

```text
docs/postman/BIELA-Backend-ERP.postman_collection.json
docs/postman/BIELA-Backend-ERP.postman_environment.json
```

It creates generated fixtures and exercises the full backend through the Gateway
only. It leaves demonstration records in the development database, so it must
not be run against production or an uncontrolled shared database.

```bash
npx dotenv -e .env -- sh -c '
npx newman run \
  docs/postman/BIELA-Backend-ERP.postman_collection.json \
  -e docs/postman/BIELA-Backend-ERP.postman_environment.json \
  --env-var "adminEmail=$SEED_ADMIN_EMAIL" \
  --env-var "adminPassword=$SEED_ADMIN_PASSWORD"
'
```

Tracked environments keep administrator credentials and generated tokens empty.
The consolidated flow verifies health, login/current user, catalog, fitment,
Locations, deterministic search, purchasing/receiving/payment/return/refund,
sales/payment/return/refund, Inventory isolation, Cash, accounts, AR/AP,
commercial summary, closing, 401, and 403.

## Current ERP scope and frontend boundary

The stable backend supports users/RBAC; Product and Vehicle catalog/fitment;
Locations, Inventory, movements, transfers, and deterministic search; Suppliers,
Purchases, Receipts, Purchase Returns, Payments and Supplier Refunds; Customers,
walk-in Sales, Sale Returns, Payments and Customer Refunds; Payment Methods,
Cash Registers/Sessions, reversals, manual Cash movements; receivables,
payables, due/overdue state, and operational commercial summary.

A frontend must call only the Gateway at port 4000. It must never connect to
ports 4001/4002 or either database. Existing list/detail APIs provide selectors
and workflow detail without exposing raw Prisma structures; redundant dropdown
APIs are unnecessary.

## Troubleshooting

- `EADDRINUSE`: identify the process already bound to the configured port. A
  duplicate process is an environment conflict, not automatically an app bug.
- MongoDB/PostgreSQL unhealthy: run `docker compose ps`, inspect the relevant
  Compose logs, and verify local `.env` credentials match the containers.
- Missing environment variable: compare ignored `.env` with `.env.example`;
  startup intentionally fails validation instead of using an unsafe fallback.
- Prisma migration failure: confirm PostgreSQL health and `DATABASE_URL`, then
  run generate, deploy, and status. Never reset a shared database.
- Gateway upstream unavailable: a normalized 502 indicates a service is down or
  timed out. Check the configured service URL and downstream health.
- Newman `ECONNREFUSED`: start all three services, verify port 4000, and run the
  aggregate health request before retrying.

## Known limitations

General accounting, journal entries, Inventory valuation/COGS, fiscal or
government invoicing, external financial/payment-provider integrations, the
frontend, AI, workshop workflows unless separately approved, and advanced
multisite operations remain deferred. Operational receivables/payables are not
an accounting ledger or financial statements.
