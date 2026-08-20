# BIELA agent guidance

BIELA (Base Integrada Empresarial de Logística Automotriz) has an approved
architecture. Do not redesign it without explicit human approval.

## Architecture and ownership

- Backend services use NestJS, TypeScript, and Node.js.
- `ms-users` owns MongoDB and all user, role, permission, and authentication data.
- `ms-autorepuesto` owns PostgreSQL and its Prisma schema/migrations.
- `api-gateway` owns no database and communicates with services only through APIs.
- Services do not read or write another service's database.
- `apps/frontend` is the React + TypeScript + Vite browser application. It calls
  only `api-gateway` through the configured public base URL.
- The future AI service is Python/FastAPI; it is not implemented yet.

## Roadmap boundaries

Backend Phases 1, 2, and 3 are implemented. Phase 1 provides environment,
authentication, users, roles, service communication, documentation, and tests.
Phase 2 provides Products, Vehicles, and deterministic Product ↔ Vehicle
Compatibility in `ms-autorepuesto` with additive Prisma migrations. Phase 3
provides physical Locations, non-negative Product + Location Inventory,
traceable stock Movements, atomic Transfers, and deterministic Product search.
Phase 4 backend integration, hardening, regression testing, and MVP
stabilization is complete. Phase 5 implements Suppliers, Purchases, partial
receiving, Purchase Returns, and traceable Inventory integration in
`ms-autorepuesto`. Phase 6 implements Customers, walk-in Sales, Sales Returns,
exact Sales money, and traceable Inventory integration. Phase 7 implements
Payment Methods, Cash Registers/Sessions, Payments, Refunds, reversals, and an
immutable physical-Cash ledger. Phase 8 extends that same ledger with Purchase
Payments, Supplier Refunds, due dates, operational receivables/payables, and a
commercial summary. Operational frontend modules, workshop, general accounting, fiscal
invoicing, external payment integrations, inventory valuation/COGS, and AI
remain unimplemented. Phase 9 verifies and documents release readiness across
the complete Phase 1–8 backend without adding a business module or migration.
Phase 10 implements only the frontend foundation, authentication, permission
guards, responsive ERP shell, and real health/commercial dashboard. No
subsequent roadmap block is approved here. Never implement a future phase
without explicit instruction.

## Migration and credential safety

- Preserve historical migrations. Schema evolution must use new additive
  migrations; never squash, rewrite applied migrations, or reset a shared
  database without explicit human approval.
- PostgreSQL extensions and indexes, including `pg_trgm`, must remain
  reproducible through migrations rather than undocumented manual setup.
- Never store administrator credentials or tokens in tracked Postman files.
  Keep secret environment values empty and inject `SEED_ADMIN_EMAIL` and
  `SEED_ADMIN_PASSWORD` from the ignored local `.env` when running Newman.

## Phase 2 domain rules

- Products contain catalog data only; never add stock quantities to Product.
- Product attributes use controlled category-specific definitions and relational
  values, not arbitrary JSON.
- Vehicles use Vehicle Brand → Vehicle Model → Vehicle with year and engine.
- `ProductCompatibility` is the explicit fitment relation and must retain its
  database-level unique `(productId, vehicleId)` constraint.
- `ms-autorepuesto` validates bearer tokens through the `ms-users` API and never
  reads MongoDB directly.

## Phase 3 domain rules

- Inventory remains separate from Product and is unique per Product + Location.
- All stock mutations use the Inventory Movement ledger; never add a direct
  quantity-overwrite API.
- OUT and TRANSFER use conditional atomic decrements inside serializable Prisma
  transactions. TRANSFER changes both locations and records its ledger entry in
  one transaction.
- ADJUSTMENT means setting a non-negative target balance and requires a reason.
- Product search is deterministic PostgreSQL search by code, name, and the
  existing Compatibility relation. Do not introduce semantic or external search.

## Phase 5 purchasing rules

- Inventory remains the only stock source of truth. A posted Purchase Receipt
  reuses Inventory `IN`; a posted Purchase Return reuses Inventory `OUT`.
- Purchase, Receipt, and Return posting share one serializable PostgreSQL
  transaction with their Inventory movements. Never mutate balances directly
  from purchasing services.
- PostgreSQL sequences generate concurrency-safe Purchase, Receipt, and Return
  numbers. Money uses Prisma Decimal/PostgreSQL NUMERIC, never JavaScript
  floating-point arithmetic.
- Confirmation does not affect stock. Posted Receipts and Returns are immutable;
  over-receipt, over-return, duplicate posting, and negative stock must fail
  without partial effects.
- `InventoryMovement` commercial references remain controlled and trace the
  originating document and line. Do not add Sales reference types before their
  separately approved phase.

## Phase 6 sales rules

- A Sale may reference an active Customer or remain walk-in with no Customer.
  Deactivation never invalidates historical documents.
- `Product.defaultSalePrice` is only a current suggestion; immutable historical
  truth is `SaleItem.unitPrice`. Sales money uses Prisma Decimal/NUMERIC.
- A DRAFT Sale has no stock effect. POST atomically calls the existing Inventory
  `OUT` engine for every line; Sales services never update balances directly.
- A posted Sale Return calls the existing Inventory `IN` engine. Eligibility is
  sold quantity minus prior POSTED returns and is protected by Sale row locking.
- Sale and Return numbers use PostgreSQL sequences. Posted documents are
  immutable and commercial line effects are unique.

## Phase 7 cash and settlement rules

- PaymentMethod kind, not arbitrary text, distinguishes CASH from non-cash.
  Inactive methods/registers reject new work but never erase history.
- A partial unique PostgreSQL index permits only one OPEN CashSession per
  register. Opening, financial operations, manual movements, and closing use
  serializable transactions and row locks.
- Cash is derived from opening amount plus immutable CashMovement semantics.
  Never store a mutable current drawer balance or use negative ledger amounts.
- CASH operations require an OPEN session on an active register. Outflows use
  the locked, derived expected amount and may never make physical Cash negative.
- Sale Payments cannot exceed the POSTED Sale outstanding amount. Refunds cannot
  exceed either the deterministic Return value remaining or active money paid
  minus active Refunds. Reversals retain history and use compensating movements.
- Phase 7 does not mutate Inventory. Supplier settlement, Accounts Payable,
  and Accounts Receivable were deferred to Phase 8. Accounting, provider
  integrations, and fiscal invoicing remain out of scope.

## Phase 8 commercial integration rules

- Extend the existing Payment and CashMovement architecture; never create a
  second supplier-payment, customer-balance, supplier-balance, or Cash ledger.
- A `PURCHASE_PAYMENT` may settle only CONFIRMED, PARTIALLY_RECEIVED, or
  RECEIVED Purchases and may not exceed the derived net obligation.
- Posted Purchase Returns reduce obligation by cumulative exact allocation of
  immutable PurchaseItem line totals. They do not automatically move money.
- A `SUPPLIER_REFUND` may not exceed both its Return value remaining and the
  Purchase's current Supplier credit. CASH refunds are physical Cash inflows.
- Purchase Payment, Supplier Refund, and reversal operations never mutate
  Inventory. PurchaseReceipt/PurchaseReturn remain the only purchasing stock
  effects.
- Receivables and payables are derived operational views over documents and
  active Payment rows; never persist mutable Customer, Supplier, Sale, or
  Purchase balances.
- `paymentDueDate` is optional, independent from document lifecycle, and
  overdue is derived against the Tegucigalpa business date only while money is
  outstanding.
- The final document lock order is Sale/Purchase, optional Return, optional
  Payment, then CashSession. Serializable retry remains bounded to three.

## Commands

- `npm run dev:users`, `npm run dev:autorepuesto`, `npm run dev:gateway`,
  `npm run dev:frontend`
- `npm run seed:admin`
- `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`
- `npm run prisma:generate`, `npm run prisma:deploy`, `npm run prisma:status
--workspace @biela/ms-autorepuesto`
- `npm audit --omit=dev`, `git diff --check`
- `docker compose up -d`, `docker compose down`

## Phase 9 release rules

- Treat the 13 Phase 1–8 PostgreSQL migrations as immutable history and prove
  them from zero when performing a release audit.
- The React frontend consumes only `api-gateway :4000`; it must not call
  internal services or databases directly.
- Keep `docs/postman/BIELA-Backend-ERP.*.json` credential-free and inject seed
  credentials only at Newman runtime.
- Phase 9 is stabilization only. General accounting, valuation/COGS, fiscal
  invoicing, provider integrations, frontend business modules, AI, workshop, and advanced
  multisite work remain outside the approved backend scope.

## Phase 10 frontend rules

- Keep the browser API base URL centralized in `VITE_API_BASE_URL`; never call
  `ms-users :4001`, `ms-autorepuesto :4002`, or either database from frontend code.
- Store only the access token in `sessionStorage` under `biela.accessToken`.
  Restore identity through Gateway `/api/auth/me`, and clear token, identity,
  and query cache on logout or an authenticated `401`.
- Do not erase a potentially valid token when restoration fails because of a
  network error, `502`, or `503`; expose retry and logout paths.
- Frontend navigation and route guards use backend-issued permission strings for
  UX only. Backend RBAC remains mandatory and authoritative.
- The dashboard may request commercial summary only with
  `commercial-summary.read`. Never invent KPIs or client-side business totals.
- Phase 10 module routes are explicit placeholders. Do not implement Product,
  Inventory, purchasing, Sales, Cash, settlement, or administration workflows
  before a separately approved frontend phase.

## Engineering expectations

Use strict TypeScript, Nest dependency injection, validated DTOs, explicit
configuration, safe errors, and small maintainable functions. Do not log or
commit secrets. Keep API documentation accurate. Add meaningful tests for
behavior and failure paths; lint, tests, and builds must pass before handoff.
