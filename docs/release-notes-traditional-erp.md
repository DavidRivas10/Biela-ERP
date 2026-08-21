# BIELA Traditional ERP Stable Release Candidate

## Purpose

This candidate packages the implemented, integrated, functionally tested and
documented traditional BIELA ERP for human release approval. It is not a claim
of production certification and no stable Git tag has been created.

## Delivered modules

Authentication, RBAC, Users/Roles; Product and Vehicle catalogs,
Compatibility and deterministic Search; Locations, Inventory, movements and
Transfers; Suppliers, Purchases, partial Receiving, Purchase Returns, Purchase
Payments, Supplier Refunds and Accounts Payable; Customers, registered/walk-in
Sales, Sale Returns, Payments, Customer Refunds and Accounts Receivable; Cash
Registers, Sessions, expected Cash, immutable movements, manual IN/OUT and
closing; health, Dashboard and operational commercial summary.

## Architecture

React 19 + TypeScript + Vite and TanStack Query call only NestJS API Gateway
port 4000. The thin Gateway forwards to `ms-users` (MongoDB identity/RBAC) and
`ms-autorepuesto` (PostgreSQL/Prisma operational ERP). See
[architecture.md](architecture.md) and [data-model.md](data-model.md).

## Core workflow guarantees

- Purchase confirmation has no stock effect; Receipt POST is Inventory IN and
  Purchase Return POST is Inventory OUT.
- Sale DRAFT has no stock effect; Sale POST is Inventory OUT and Sale Return
  POST is Inventory IN.
- Payment/Refund/reversal never directly changes Inventory. CASH operations use
  an OPEN Session and its immutable physical-Cash ledger.
- Inventory, exact money, return/payment eligibility, settlement, expected Cash
  and lifecycle transitions remain backend-authoritative and concurrency-safe.

## Release evidence

| Gate | Evidence |
| --- | --- |
| Frontend | 26 files / 126 tests passed |
| Backend unit | 15 suites / 38 tests passed |
| Backend E2E | 19 suites / 134 tests passed: Gateway 1/15, autorepuesto 17/118, users 1/1 |
| Concurrency | 5 suite files / 22 scenarios passed within autorepuesto E2E |
| Functional | 79 PASS / 0 FAIL / 0 BLOCKED, separate from automated totals |
| Automated total | 298 tests / 0 failures |
| Database | 13 migrations / 0 pending; Prisma 6.19.3 |
| Live API contract | Gateway 94 paths / 131 operations; Users 9/13; Autorepuesto 85/118 |
| Postman | 75 credential-free requests, including bounded Session summary and paginated Cash Movements |
| Dependencies | `npm audit --omit=dev`: 0 vulnerabilities |
| Defects | 0 open BLOCKER/HIGH/MEDIUM/LOW; F12-001 and F12-002 CLOSED |

The final Phase 13 execution must reconfirm these values before human handoff.
Phase 13 added one presentation-only regression assertion for Spanish Payment
type/method labels; the 79 Phase 12 functional scenarios remain separate.

## Setup and upgrade notes

This is the first recommended stable traditional ERP tag, so no prior stable
upgrade path is declared. Bootstrap with `npm ci`, Compose databases, Prisma
generate/deploy/status, the idempotent admin seed, and the four documented dev
commands. Existing environments must preserve and deploy all 13 migrations in
order; never rewrite them or reset shared data. See
[operations-guide.md](operations-guide.md).

## Security posture

Exact backend RBAC is authoritative; passwords and hashes are not returned;
JWT and credentials are not tracked or logged; CORS is an explicit origin list;
browser business traffic is Gateway-only; the Gateway has no database/ORM or
business calculations. Environment and Postman examples are credential-free.

## Known limitations and deferred scope

The final frontend artifacts are 0.57 kB HTML (0.35 kB gzip), 17.00 kB CSS
(4.53 kB gzip) and 518.49 kB JavaScript (130.56 kB gzip). The JavaScript
bundle remains slightly above Vite's 500 kB warning threshold but is functional
and non-blocking. General accounting,
fiscal invoicing, Inventory valuation/COGS accounting, external payment
integrations, offline operation, advanced workshop/multisite expansion and AI
are intentionally deferred. Operational AR/AP is not general accounting.

## Defect closure

- F12-001 (MEDIUM), Spanish insufficient-Cash rejection: CLOSED.
- F12-002 (MEDIUM), pagination/table landmarks: CLOSED.
- F13-001 (LOW), internal financial enum/identifier terminology visible in
  operational UI: CLOSED with Spanish labels and one formatter regression test.

Open BLOCKER: 0. Open HIGH: 0. Open MEDIUM: 0. Open LOW: 0.

## Release action

Recommended after human verification: `v1.0.0` with release title **BIELA
Traditional ERP**. Use this file as the release-note source. Human review,
commit, push, Jira synchronization, tag and optional GitHub Release remain
external actions.
