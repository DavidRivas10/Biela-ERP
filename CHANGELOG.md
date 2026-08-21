# Changelog

All notable BIELA traditional ERP milestones are summarized here. Historical
commit messages remain unchanged.

## Unreleased — Traditional ERP stable release candidate

- Completed engineering closure documentation, architecture and ER diagrams,
  Spanish user/admin/demo material, operational troubleshooting, backup/restore
  tooling and release handoff evidence.
- Preserved the Phase 12 release baseline and added one presentation regression
  test: 298 current automated tests, 79 historical functional scenarios, 13
  migrations, zero known BLOCKER/HIGH defects, and no Phase 13 business or
  schema change.
- Replaced visible financial enum/identifier terminology with Spanish business
  labels without changing API values, permissions or commands.
- Prepared Jira reconciliation and human-only Git/tag/release actions without
  performing external writes.

## Official Phase 12 — Functional ERP verification

- Executed a realistic end-to-end business day, RBAC, recovery, pagination,
  accessibility, responsive behavior, financial/Inventory reconciliation, and
  concurrency protection.
- Closed F12-001 and F12-002; 79 scenarios passed with zero failed or blocked.

## Official Phase 11 — Complete Frontend ↔ Backend integration

- Verified all approved frontend modules through the thin Gateway.
- Closed cross-domain cache, selector reachability, Cash ledger pagination,
  summary payload, error, network-boundary, and permission contracts.

## Official Phase 10 — Complete frontend

- 10.A: authentication, permission-aware application shell and Dashboard.
- 10.B: catalog, Vehicles, Compatibility, Inventory, Transfers and Search.
- 10.C: Suppliers, purchasing, Receiving, Returns, settlement and payables.
- 10.D: Customers, Sales, Returns, settlement and receivables.
- 10.E: Cash Registers/Sessions/Movements plus Users and Roles.

## Backend Phases 1–9

- 1: NestJS foundation, JWT authentication, Users, Roles, permissions, service
  health, Swagger, Postman, CI, MongoDB and PostgreSQL ownership.
- 2: automotive Product/Vehicle catalogs and explicit Compatibility.
- 3: Locations, non-negative Inventory, immutable movements, Transfers and
  deterministic Product search.
- 4: backend integration and MVP stabilization.
- 5: Suppliers, Purchases, partial Receiving and Purchase Returns.
- 6: Customers, walk-in Sales, Sale posting and Sale Returns.
- 7: Payment Methods, Cash Registers/Sessions, Payments, Refunds, reversals and
  immutable physical-Cash movements.
- 8: supplier settlement, due dates, accounts, operational AR/AP and commercial
  summary.
- 9: complete backend regression, migration reproducibility, release contracts
  and security/readiness evidence.
