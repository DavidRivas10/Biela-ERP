# BIELA Official Phase 12 Functional Test Report

## Scope and evidence

Official Phase 12 exercised the traditional ERP as an integrated system. The
controlled business-day dataset uses the `FUNC12-` prefix and was operated
through the public Gateway contract and the production browser application.
No direct database mutation, schema change, migration, mock business response,
or backend business-rule override was used.

The primary trace was:

`React UI -> API Gateway :4000 -> ms-users/ms-autorepuesto -> MongoDB/PostgreSQL -> Gateway response -> React Query/UI`

The main run used one registered Customer, one walk-in Sale, one Supplier, one
Product, one compatible Vehicle, two physical Locations, split Cash/non-Cash
settlement, Returns/Refunds, a Cash Session, due dates, page-two documents, and
controlled concurrent commands. Generated records intentionally remain in the
local test database for inspection.

## Business-day reconciliation

| Control | Expected | Observed | Result |
| --- | ---: | ---: | --- |
| Initial Product stock | 150 units | A 100 + B 50 | PASS |
| Purchase confirmation stock effect | 0 | 150 units before/after | PASS |
| Two posted partial Receipts | +10 | 160 units | PASS |
| Posted Purchase Return | -2 | 158 units | PASS |
| Posted registered Sale | -4 | 154 units | PASS |
| Posted Sale Return | +1 | 155 units | PASS |
| Transfer A -> B | 0 total | A 103 + B 52 before scale documents | PASS |
| Due-date and pagination Sales | -25 | A 78 + B 52 | PASS |
| Concurrency Sale/Receipt pair | -1 + 1 | final 130 units | PASS |
| Main Cash Session expected Cash | L 491.82 | L 491.82 | PASS |
| Main Cash Session counted Cash | L 491.82 | L 491.82 | PASS |
| Main Cash Session difference | L 0.00 | L 0.00 | PASS |
| Supplier scoped outstanding | L 24.40 | L 24.40 | PASS |
| Registered Customer scoped outstanding | L 44.18 | L 44.18 | PASS |
| Walk-in outstanding | L 19.99 | present in global Receivables | PASS |

The Supplier account contains 26 documents: three paid and 23 unpaid. The
Customer account contains 26 documents: three paid and 23 unpaid. The
additional walk-in Sale is correctly absent from the registered Customer
account and present in global Receivables. The global Dashboard remained stable
after fully settled concurrency documents and after temporary Cash Sessions
were closed: outstanding Receivables `881.81`, Payables `298.64`, one pre-existing
OPEN session, and expected Cash `500.00`.

## Lifecycle and invariant results

- DRAFT Purchase/Sale and DRAFT Returns did not change Inventory.
- Purchase confirmation and partial settlement did not change Inventory.
- Receipts changed Inventory only when posted; partial 4 + 6 reached RECEIVED.
- Sale posting and Return posting produced exactly one stock effect each.
- Duplicate Compatibility, second Cash opening, over-receipt, over-return,
  overpayment, over-refund, insufficient Cash, same-location Transfer, second
  close, and movement after close were rejected with `400`/`409` as applicable.
- Cash/non-Cash Payments and Refunds, reversals, and replacement operations kept
  their document and Cash effects traceable.
- Past-due documents became non-overdue immediately after full settlement.
  Current/future due-date filters returned the intended documents.
- Updating current Product price/name, Customer name, and Supplier name did not
  alter historical line snapshots: Purchase `10.1000`, Sale `19.9900`, while
  current Product price became `29.99`.
- Inactive Product, Customer, Supplier, Location, and Register records were
  excluded from active selectors/lists while direct historical detail remained
  readable; each controlled record was reactivated after verification.

## Scale, pagination, and search

- Supplier and Customer accounts: page 1 returned 20 and page 2 returned 5
  distinct documents from 25 at the initial scale checkpoint.
- Global scoped Payables and Receivables: page 1 returned 20 and page 2 returned
  3 distinct outstanding documents from 23.
- Users: page 1 returned 20, page 2 returned 18, total 38 at the checkpoint.
- Cash Movements: total 141; pages 1, 2, and 6 returned reachable rows with
  `limit=20`, disjoint adjacent pages, and deterministic newest-first order.
- Cash Movement server filters were verified for Session, Register, movement
  type, reference, and timestamp range. Session summary with
  `includeMovements=false` returned zero movement rows and authoritative
  expected Cash `491.82`.
- A Product, Location, and Customer outside their initial 20-row pages were
  found in the Sale form through debounced server search. Browser network
  evidence showed `page=1&limit=20&active=true&search=...` Gateway requests;
  client-only filtering of page 1 was not used.
- Deterministic Product Search returned the controlled Product by code and by
  name + compatible Vehicle + in-stock filter, and returned an explicit empty
  result for a non-match.
- Cash Movement UI made one paginated ledger request plus bounded Register data;
  it did not fetch individual Cash Sessions per ledger row.

## Authentication, Users, Roles, and RBAC

- Admin login and `/auth/me` restoration passed.
- A controlled role initially contained only `products.read`: Product read was
  `200`, Product mutation and Sales read were `403`, and the session survived.
- Adding `sales.read` to that Role was effective for the already-issued token;
  the next Sales request was `200` and `/auth/me` returned the new permission.
- User deactivation made both the current token and login return `401`.
  Reactivation restored login.
- Invalid/no token returned `401`; logout and an authenticated `401` removed
  `biela.accessToken` and redirected to Login.
- A limited browser session rendered only Dashboard, Sales, and Product catalog
  navigation and redirected direct `/app/admin/users` access to `/forbidden`.
- User, login, and identity responses exposed neither password input nor
  `passwordHash`.

## Recovery, concurrency, and stale state

- With `ms-autorepuesto` stopped, an Inventory screen rendered retry UX through
  a Gateway upstream failure; retry populated the same filtered URL after the
  service restarted.
- With `ms-users` or Gateway stopped, authentication restoration rendered
  “No podemos validar tu acceso”, retained the token and current URL, and
  offered Retry/Logout. Retry restored the requested Dashboard/User page.
- Parallel duplicate commands produced `[201, 409]` for Sale posting, full
  Payment, Receipt posting, and Cash Session opening. Inventory changed only
  once for each stock command and only one OPEN session existed.
- Refresh, browser Back/Forward, and query-string state preserved Cash Movement
  reference/page filters and User page 2.

### Exact concurrency regression inventory

The final `ms-autorepuesto` E2E execution passed 17 suites / 118 tests. The
following concurrency counts are a subset of those 118 tests, not additional
tests:

| Classification | File / suite | Scenarios represented | Passed | Failed |
| --- | --- | ---: | ---: | ---: |
| Dedicated | `commercial-concurrency.e2e-spec.ts` — Phase 8 commercial concurrency with PostgreSQL | 5: concurrent Purchase Payments; concurrent Supplier Refunds; Cash Purchase Payment vs close; Cash Supplier Refund vs close; Payment reversal vs Supplier Refund eligibility | 5 | 0 |
| Dedicated | `finance-concurrency.e2e-spec.ts` — Phase 7 financial concurrency with PostgreSQL | 8: one OPEN Session; concurrent Sale Payments; concurrent Customer Refunds; MANUAL_OUT negative-Cash prevention; reversal idempotence; Payment vs close; Refund/manual movement vs close; one close transition | 8 | 0 |
| Dedicated | `purchasing-concurrency.e2e-spec.ts` — Purchasing posting concurrency with PostgreSQL | 4: cumulative over-receipt prevention; same Receipt double post; cumulative Return eligibility; Return physical-stock protection | 4 | 0 |
| Dedicated | `sales-concurrency.e2e-spec.ts` — Sales posting concurrency with PostgreSQL | 4: competing Sales oversell prevention; same Sale double POST; concurrent Return eligibility; atomic multi-line competing Sales | 4 | 0 |
| Embedded in regular E2E suite | `transfers.e2e-spec.ts` | 1: concurrent OUT commands cannot produce negative stock | 1 | 0 |
| **Total** | **4 dedicated suites plus 1 embedded scenario in a fifth suite file** | **22** | **22** | **0** |

The four dedicated suites therefore contain exactly **21** scenarios, all
passed. Including the embedded Inventory scenario gives exactly **5 suite
files / 22 concurrency scenarios**, all passed. Coverage includes Inventory,
Purchasing, Sales, Finance/Cash, and commercial settlement.

Two additional stale/repeated-command protections are embedded in broader
non-concurrency tests and are not counted again in the 22: the Receipt scenario
in `purchasing.e2e-spec.ts` rejects a stale excessive Receipt and a second POST
of an already posted Receipt; its Return scenario rejects a second POST and a
stale excessive Return. The Phase 12 live functional run separately observed
`[201, 409]` for duplicate Sale POST, full Payment, Receipt POST, and Cash
Session opening, plus `409` for a second close, overpayment, over-refund, and
stale/over-eligibility attempts.

Phase 12 changed no backend concurrency, transaction, row-locking,
serializable-retry, Cash lifecycle, or business-locking code.

## Browser, responsive, accessibility, and network

- Desktop Dashboard, filtered Cash ledger, detail links, and page 2 rendered
  without page errors. Core Web Vitals sample: TTFB `2.4 ms`, FCP `248 ms`,
  LCP `308 ms`, CLS `0.0121`.
- At `390 x 844`, Sale, Purchase, Inventory, Receivables, Users, Search, and
  Cash Session screens had `document.scrollWidth === innerWidth`; wide tables
  remained keyboard-scrollable inside their panels.
- A mobile Cash flow created a manual L 1.00 entry, refreshed expected Cash from
  L 10.00 to L 11.00, and closed with L 0.00 difference.
- Representative keyboard focus, labels, dialogs, tables, and navigation were
  checked. After correction, axe 4.12.1 reported zero violations and zero
  incomplete checks on the desktop Cash ledger and mobile Sale form.
- Browser requests were limited to Vite assets and `localhost:4000/api/...`.
  No request targeted `:4001`, `:4002`, MongoDB, or PostgreSQL.

## Defects

| ID | Area | Scenario | Severity | Observed | Expected | Root cause | Correction | Regression | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F12-001 | Cash error UX | Manual Cash OUT above expected Cash | MEDIUM | Spanish form rendered raw backend text `Insufficient expected Cash in session` | Clear Spanish operational feedback while preserving backend rejection | Generic frontend error presenter passed this backend message through verbatim | Exact presentation translation: `El efectivo esperado de la sesión es insuficiente.` Backend status/rule unchanged | `api-error.test.ts`: `presents the insufficient Cash business rejection in Spanish`; live browser retry | CLOSED |
| F12-002 | Accessibility | Cash ledger and forms with multiple paginators | MEDIUM | axe `landmark-unique`; table scroll label lacked an explicit landmark role in the first audit | Unique named navigation landmarks and a labelled keyboard-scroll region | Reusable Pagination used the same accessible name; table wrapper had `aria-label` without `role` | Contextual paginator labels; `role="region"` on the scroll container | `ErpTable.test.tsx`: `exposes its keyboard-scrollable container as a labelled region`; updated `erp-components.test.tsx`: `supports pagination boundaries`; axe re-run | CLOSED |

Open Phase 12 defects: **0**. No schema, migration, backend authorization,
business invariant, Gateway ownership, or roadmap boundary change was required.

## Automated gate

- `npm ci`: 936 packages installed; production dependency audit reported zero
  vulnerabilities.
- Prisma Client generation/deploy/status: passed; exactly 13 migrations, zero
  pending, database schema up to date.
- Lint: all four workspaces passed with zero warnings/errors.
- Backend unit: 15 suites, 38 tests passed (Gateway 2/5, autorepuesto 9/23,
  users 4/10).
- Frontend unit/component: 26 files, 125 tests passed. Phase 12 added three
  focused assertions across the new error and table accessibility test files.
- E2E: 19 suites, 134 tests passed (Gateway 1/15, autorepuesto 17/118,
  users 1/1).
- Concurrency regression within the 118 autorepuesto E2E tests: four dedicated
  suites / 21 scenarios plus one concurrent Inventory scenario embedded in
  `transfers.e2e-spec.ts`; five suite files / 22 scenarios passed, zero failed.
- Total automated tests: **297** (`38 + 125 + 134`), with **0 failures**. The 79
  functional-matrix scenarios are a separate executed evidence checklist; they
  overlap some automated protections and are not added to the automated count.
- Build: all workspaces passed. Frontend output: HTML 0.57 kB (0.35 gzip), CSS
  17.00 kB (4.53 gzip), JS 518.18 kB (130.38 gzip). The existing >500 kB
  single-chunk warning remains non-blocking and is not a Phase 12 regression.
- `git diff --check`, including the new untracked report/test files: clean.

## Deferred scope

Still deferred: general accounting, fiscal invoicing, Inventory valuation/COGS
accounting, external payment-provider integrations, offline mode, workshop and
advanced multisite workflows unless separately approved, and AI.

## Status

Official Phase 12 Status: **COMPLETE**

ERP Functional Readiness: **READY FOR OFFICIAL PHASE 13**

Next Official Phase: **Phase 13 — Traditional ERP Closure, Documentation, Jira,
Demo and Stable Release**

Phase 13 is named only as the roadmap handoff. It is not implemented here.
