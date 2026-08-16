# BIELA agent guidance

BIELA (Base Integrada Empresarial de Logística Automotriz) has an approved
architecture. Do not redesign it without explicit human approval.

## Architecture and ownership

- Backend services use NestJS, TypeScript, and Node.js.
- `ms-users` owns MongoDB and all user, role, permission, and authentication data.
- `ms-autorepuesto` owns PostgreSQL and its Prisma schema/migrations.
- `api-gateway` owns no database and communicates with services only through APIs.
- Services do not read or write another service's database.
- The future frontend is React + TypeScript; do not implement it in Phase 1.
- The future AI service is Python/FastAPI; do not implement it in Phase 1.

## Roadmap boundaries

The current phase is Backend Phase 1: environment, authentication, basic users
and roles, service communication, documentation, and tests. The next phase is
products, vehicles, and compatibility. Later phases cover inventory, commerce,
workshop, and intelligence. Never implement a future phase without explicit
instruction.

## Commands

- `npm run dev:users`, `npm run dev:autorepuesto`, `npm run dev:gateway`
- `npm run seed:admin`
- `npm run lint`, `npm test`, `npm run build`
- `docker compose up -d`, `docker compose down`

## Engineering expectations

Use strict TypeScript, Nest dependency injection, validated DTOs, explicit
configuration, safe errors, and small maintainable functions. Do not log or
commit secrets. Keep API documentation accurate. Add meaningful tests for
behavior and failure paths; lint, tests, and builds must pass before handoff.
