# BIELA agent guidance

BIELA (Base Integrada Empresarial de Logística Automotriz) has an approved
architecture. Do not redesign it without explicit human approval.

## Architecture and ownership

- Backend services use NestJS, TypeScript, and Node.js.
- `ms-users` owns MongoDB and all user, role, permission, and authentication data.
- `ms-autorepuesto` owns PostgreSQL and its Prisma schema/migrations.
- `api-gateway` owns no database and communicates with services only through APIs.
- Services do not read or write another service's database.
- The future frontend is React + TypeScript; it is not implemented yet.
- The future AI service is Python/FastAPI; it is not implemented yet.

## Roadmap boundaries

Backend Phases 1 and 2 are implemented. Phase 1 provides environment,
authentication, users, roles, service communication, documentation, and tests.
Phase 2 provides Products, Vehicles, and deterministic Product ↔ Vehicle
Compatibility in `ms-autorepuesto` with additive Prisma migrations. The next
approved phase is inventory, physical locations, and deterministic search.
Later phases cover commerce, workshop, and intelligence. Never implement a
future phase without explicit instruction.

## Phase 2 domain rules

- Products contain catalog data only; never add stock quantities to Product.
- Product attributes use controlled category-specific definitions and relational
  values, not arbitrary JSON.
- Vehicles use Vehicle Brand → Vehicle Model → Vehicle with year and engine.
- `ProductCompatibility` is the explicit fitment relation and must retain its
  database-level unique `(productId, vehicleId)` constraint.
- `ms-autorepuesto` validates bearer tokens through the `ms-users` API and never
  reads MongoDB directly.

## Commands

- `npm run dev:users`, `npm run dev:autorepuesto`, `npm run dev:gateway`
- `npm run seed:admin`
- `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`
- `npm run prisma:generate`, `npm run prisma:deploy`
- `docker compose up -d`, `docker compose down`

## Engineering expectations

Use strict TypeScript, Nest dependency injection, validated DTOs, explicit
configuration, safe errors, and small maintainable functions. Do not log or
commit secrets. Keep API documentation accurate. Add meaningful tests for
behavior and failure paths; lint, tests, and builds must pass before handoff.
