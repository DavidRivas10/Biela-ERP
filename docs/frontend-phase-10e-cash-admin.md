# BIELA — FRONTEND PHASE 10.E

## Cash Registers, Cash Sessions, Cash Movements, Users and Roles

Phase 10.E is the final implementation subphase of official Frontend Phase 10.
It adds real operational screens for Cash and administration without adding a
database, financial rules, or business calculations to the browser. After
10.E comes official Phase 11 — Complete Frontend ↔ Backend Integration.

## Routes and permissions

| Route | Read permission | Mutation permission |
| --- | --- | --- |
| `/app/cash/registers` | `cash-registers.read` | `cash-registers.manage` |
| `/app/cash/sessions` | `cash-sessions.read` | `cash-sessions.open`, `cash-sessions.close` |
| `/app/cash/movements` | `cash-movements.read` | `cash-movements.create` |
| `/app/admin/users` | `users.read` | `users.create`, `users.update`, `users.activate`, `users.deactivate` |
| `/app/admin/roles` | `roles.read` | `roles.manage` |

Navigation and route guards mirror these exact codes for UX. Backend guards
remain authoritative and a normal `403` does not clear an authenticated
session.

## Cash contracts

Cash Registers support paginated server search, lifecycle, detail, and a
current-session lookup without per-row requests. Session lists are
server-paginated and filter by Register, status, opening actor, and opening date
range. Register selectors render 20 rows and preserve a selected detail while
server search and pagination keep every valid Register reachable.

The immutable ledger is read with `GET /api/cash-movements`. It supports page
and limit plus Cash Session, Cash Register, exact movement type, Payment ID or
Payment/document reference, and timestamp range filters. Results are ordered
newest-first by `createdAt`, then `id`. Related Session, Register, Payment, and
Payment Method data are included in the bounded response, avoiding N+1 browser
lookups.

Session detail requests
`GET /api/cash-sessions/:id/summary?includeMovements=false`. This retains the
existing summary fields, movement totals, Payment Method totals, and exact
backend-derived expected Cash while returning no ever-growing embedded ledger.
The separate ledger query provides paginated history. Omitting the query keeps
the legacy summary response, including movements, backward-compatible.

Opening, manual `MANUAL_IN`/`MANUAL_OUT`, and closing are explicit confirmed
commands. The browser keeps decimal values as strings and never decides drawer
availability, expected Cash, one-open-session eligibility, closing difference,
or concurrency outcomes. Mutations invalidate the relevant Register, Session,
summary, and Movement query roots and are not optimistic.

## Users, Roles, and security

Users use server pagination and server search; the frontend never loads all
users. Create uses the exact initial-password DTO. The password exists only in
the controlled password input, is cleared after success, and is never stored or
logged. Edit cannot overwrite a password because the backend update DTO omits
it. Activate/deactivate preserve identity and history.

The Role contract is a naturally small, controlled, sorted backend list. User
forms use returned Role IDs and never hardcode identifiers. Role list, detail,
create, and edit reflect the existing `roles.manage` contract. Permission codes
are displayed by domain for readability but sent unchanged; the backend still
validates the catalog.

## Query/cache behavior and errors

Central query keys cover Registers, current Sessions, Sessions, Session
summaries, Cash Movements, Users, and Roles. Command success uses targeted
invalidation. Screens preserve form input after `400`, `403`, `404`, `409`,
`502`, or `503`; conflicts are presented as backend business errors and never
as local success.

Lists, forms, dialogs, badges, horizontally scrollable tables, keyboard focus,
labels, loading, empty, and retry states reuse the existing responsive ERP
components. At narrow widths forms collapse to one column, actions wrap, and
the permission grid remains bounded.

## Approved Phase 10 completion audit

| Area | State |
| --- | --- |
| Authentication | IMPLEMENTED |
| Dashboard | IMPLEMENTED |
| Users / Roles | IMPLEMENTED |
| Catalog / Vehicles / Compatibility | IMPLEMENTED |
| Inventory / Search | IMPLEMENTED |
| Suppliers / Purchasing / Receiving / Purchase Returns / Payables | IMPLEMENTED |
| Customers / Sales / Sale Returns / Receivables | IMPLEMENTED |
| Cash Registers / Cash Sessions / Cash Movements | IMPLEMENTED |

No approved Phase 10 Sidebar item or protected route remains a placeholder.
Accounting, fiscal invoicing, COGS/accounting valuation, external payment
integrations, offline operation, workshop, and AI remain outside Phase 10.

## Verification

From the repository root run `npm run lint`, `npm test`, `npm run test:e2e`,
`npm run build`, `npm audit --omit=dev`, and `git diff --check`. Database release
verification also runs Prisma generate/deploy/status and confirms the original
13 PostgreSQL migrations with zero pending migrations.
