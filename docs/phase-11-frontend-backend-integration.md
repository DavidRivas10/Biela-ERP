# BIELA — Official Phase 11

## Complete Frontend ↔ Backend Integration

Official Phase 10 is complete. This Phase 11 artifact records the integration
and stabilization of all approved browser modules against the stable traditional
ERP backend. It is not a new frontend subphase and does not begin Phase 12.

## Architecture and network boundary

```text
Browser :5173
  -> React + TypeScript + TanStack Query
  -> centralized /api client
  -> API Gateway :4000
       -> ms-users :4001 -> MongoDB
       -> ms-autorepuesto :4002 -> PostgreSQL
```

The browser accepts only absolute `/api/...` paths and the centralized client
rejects a configured API origin that differs from `VITE_API_BASE_URL`. Static
and live browser inspection found no direct request to either internal service
or database port. Gateway owns no ORM/database dependency and forwards request
transport only; Inventory, financial, Cash, permission, and lifecycle authority
remain in their owning backend services. Local CORS remains scoped to configured
origins, including `http://localhost:5173`, with no wildcard.

The complete route/permission mapping is in
[`phase-11-integration-matrix.md`](phase-11-integration-matrix.md).

## Authentication, session, and RBAC

- Valid login traverses Gateway to `ms-users`, stores only the access token in
  `sessionStorage` under `biela.accessToken`, and restores identity through
  `/api/auth/me`.
- Invalid credentials return 401 with credential-specific copy. A 401 from an
  authenticated request clears identity, token, and query cache.
- A 403 displays Forbidden without logging out. A generated restricted user was
  able to read its permitted Product/Inventory/Search/Cash routes, saw no
  purchasing, sales, or administration navigation, had mutation controls hidden,
  and received 403 on a direct forbidden Product mutation.
- A simulated `/api/auth/me` network failure preserved the token and displayed
  the retry/logout recovery state. Retrying after recovery restored the same
  protected deep link without another login.
- Role permissions are resolved from current MongoDB state for every backend
  request. A Role change therefore affects backend authorization immediately;
  the browser sees the new effective set on its next `/api/auth/me` refresh.
- Password fields are write-only. Neither User/Role responses nor rendered UI
  expose `passwordHash`, and no password/token is logged by application code.

## Targeted live integration evidence

Generated entities used the `INT11-` prefix and remain as non-sensitive Phase 12
fixtures. No database was wiped.

### Catalog, Compatibility, Inventory, and Search

- A Product, Vehicle hierarchy, Compatibility, two Locations, and initial stock
  were created through Gateway contracts.
- Product list and deterministic Search found the Product; Product → Vehicles
  and Vehicle → Products each returned the explicit Compatibility.
- Inventory moved through: initial `20`; Purchase draft unchanged `20`; Receipt
  post `30`; Purchase Return post `28`; Transfer produced `26/2`; Sale post
  reduced source to `21`; Sale Return post restored it to `22`; a walk-in Sale
  reduced the other Location to `1`. Final Product stock was `23`.
- Movement history contained the expected `INITIAL`, `IN`, `OUT`, and
  `TRANSFER` entries. The frontend never wrote a balance directly.

### Purchasing, return, settlement, and Cash

- Supplier → Purchase draft → Confirm → Receipt draft/post → Inventory IN
  completed. Draft creation and confirmation did not alter stock.
- Exact Purchase total was `100.00`; payment reached PAID. A posted Return of
  `20.00` reduced the net obligation to `80.00`; eligible Supplier Refund
  completed, leaving Supplier outstanding/credit `0.00` and no remaining global
  Payables row for that Purchase.
- CASH Purchase Payment and Supplier Refund generated ledger movements;
  non-CASH settlement generated no physical Cash effect. A Purchase Payment
  reversal generated its compensating movement.

### Sales, return, settlement, and Cash

- Registered Customer and walk-in Sale paths both completed. Sale drafts did
  not alter stock; posting produced Inventory OUT.
- The registered Sale total was `100.00`, was settled with split payment, and
  later reflected a posted Return and Customer Refund. The Customer account
  ended at `0.00`; the walk-in outstanding Sale remained visible in global
  Receivables.
- CASH Sale Payment/Customer Refund and both reversals generated the exact
  compensating movement types. Non-CASH settlement had no physical Cash effect.

### Cash session

- A generated Register opened with `500.00` and accepted commercial operations,
  `MANUAL_IN 10.00`, and `MANUAL_OUT 5.00`.
- The backend-derived expected amount before close was `505.00`. Closing with
  `504.00` persisted a `-1.00` difference. A post-close movement was rejected
  with 409.
- The session contained all ten required Phase 11 types:
  `MANUAL_IN`, `MANUAL_OUT`, `SALE_PAYMENT`, `SALE_PAYMENT_REVERSAL`,
  `SALE_REFUND`, `SALE_REFUND_REVERSAL`, `PURCHASE_PAYMENT`,
  `PURCHASE_PAYMENT_REVERSAL`, `SUPPLIER_REFUND`, and
  `SUPPLIER_REFUND_REVERSAL`.
- The normal summary request used `includeMovements=false` and returned an empty
  embedded movement array; the ledger was fetched once, paginated, with Session,
  Register, Payment, and Payment Method context already included. There was no
  N+1 Session fetch.

## Dashboard and commercial consistency

The Dashboard displayed only live `/api/system/health` and
`/api/commercial/summary` values. The targeted walk-in Sale changed global
Receivables by its exact outstanding `20.00`; purchasing settlement and Returns
were reflected in Payables, Supplier account, Customer account, and document
settlement responses. Expected Cash and OPEN Session counts came directly from
the backend summary. React performs no authoritative AR, AP, overdue, change,
or Cash calculation.

## Query and cache corrections

Phase 11 found and corrected real cross-module stale-state risks:

1. Dashboard summary used `commercial-summary`, while purchasing invalidated a
   non-matching `commercial/summary` key. The key is now centralized.
2. Receipt/Return and Sale posting invalidated only list-level Inventory keys,
   leaving Product/Location inventory queries stale. Stock effects now
   invalidate the scoped Inventory domain plus deterministic Search.
3. Sale Return posting omitted its source Sale detail; it now invalidates the
   returned `saleId` detail.
4. Payment, Refund, and reversal operations omitted Cash Session summaries and
   the Cash ledger; they now share Cash integration invalidation.
5. Purchase/Sale lifecycle changes and Cash Session open/close omitted the
   Dashboard commercial summary; those exact mutations now invalidate it.
6. Role edits invalidated Role data but not Users that embed Role data; Role
   integration now invalidates User list/detail queries.
7. Product, Vehicle, Location, Supplier, Customer, and Cash Register edits could
   leave embedded reference labels/statuses stale in related operational views;
   scoped reference invalidation now refreshes only their dependent domains.
8. Cash operations now also invalidate the Cash Session list, whose rows expose
   backend-derived expected amounts; Purchase lifecycle/Receipt posting also
   refresh Supplier-account and Payables projections.
9. Sale and Sale Return line tables used a container class without the shared
   horizontal-scroll rule. The rule now keeps wide lines inside their panel at
   mobile width.

The helpers invalidate domain roots, not the entire Query Client. Commands remain
non-optimistic for Inventory and finance.

## Error contract

Live Gateway checks preserved meaningful 400, 401, 404, and 409 responses with
messages and no raw stack. The restricted user proved 403 without logout.
Gateway transport failures normalize to 502; `ms-autorepuesto` authentication
dependency failure remains 503. Frontend authentication distinguishes invalid
credentials from service/network unavailability and preserves recoverable
session context.

## Scale and pagination

- Products, Vehicles, Compatibility, Locations, Inventory, Inventory Movements,
  Search, Suppliers, Purchases, Receipts/Returns, Payments/Refunds, AP, Customers,
  Sales, AR, Cash Registers, Cash Sessions, Cash Movements, and Users use server
  pagination and/or server search. UI page controls expose later pages.
- All high-cardinality selectors debounce server search and/or expose incremental
  server pages. No selector searches only the first backend page and no
  unbounded load-all contract was introduced.
- Live data contained 135 Cash Movements. Pages 1, 2, and 6 with `limit=20`
  returned reachable records, proving data after record 100 is not hidden.
  Product and User page 2 also returned distinct records.
- Cash Movement filters by Session, Register, movement type, Payment/reference,
  and created timestamp range returned only matching rows with deterministic
  `createdAt DESC, id DESC` ordering.
- Role retrieval remains intentionally unpaginated because it is the controlled
  backend role list, not an operational high-cardinality ledger.

## Deep links, responsive UI, and accessibility spot check

Authenticated refresh/deep links were exercised for Product, Purchase, Sale,
Cash Session, and User details. At `390×844`, Dashboard, Product, Purchase, Sale,
Inventory, Payables, Receivables, Cash Session, and Users remained usable with no
document-level overflow. Phase 11 corrected the Sale/Sale Return line table
container so wide columns scroll inside the panel instead of widening the page.
Representative form labels, links/buttons, dialog semantics, table scroll
regions, focus styling, and keyboard-reachable controls were retained. This is
an integration spot check, not a formal accessibility certification.

## Security and scope

No secret, credential, token, direct database URL, internal-service URL, fake
operational data, placeholder module, roadmap label in production UI, Gateway
business logic, Prisma major upgrade, schema edit, or migration was introduced.
The 13 historical PostgreSQL migrations remain unchanged.

## Automated verification

- `npm ci`: passed; lockfile installation completed with 0 vulnerabilities.
- Prisma Client generation, migration deploy, and migration status: passed;
  13 migrations found and database schema up to date.
- Lint: all four workspaces passed with zero warnings/errors.
- Frontend: 24 test files and 122 tests passed. Nine dedicated Phase 11 tests
  cover the centralized cross-module invalidation domains; the existing Receipt
  screen regression was updated to assert the full Inventory/Search refresh.
- Backend unit: 15 suites and 38 tests passed (`api-gateway` 2/5,
  `ms-autorepuesto` 9/23, `ms-users` 4/10).
- E2E: Gateway 1 suite/15 tests; `ms-autorepuesto` 17 suites/118 tests;
  `ms-users` 1 suite/1 test. The four dedicated concurrency suites contain 21
  scenarios; the Transfer suite adds the Inventory concurrent-OUT scenario, for
  5 suites/22 concurrency scenarios verified.
- Build: all workspaces passed. Frontend output was HTML 0.57 kB (0.35 gzip),
  CSS 17.00 kB (4.53 gzip), and JS 517.69 kB (130.27 gzip). The existing
  >500 kB chunk warning remains non-blocking.
- Production dependency audit: 0 vulnerabilities. `git diff --check`: clean.
- Total automated failures: 0.

Still intentionally deferred: general accounting, fiscal invoicing,
Inventory valuation/COGS accounting, external payment integrations, offline
operation, workshop/advanced multisite work unless separately approved, and AI.

## Status and handoff

Official Phase 11 Status: **COMPLETE**

ERP Integration Readiness: **READY FOR OFFICIAL PHASE 12**

Next Official Phase: **Phase 12 — Functional End-to-End ERP Testing and
Corrections**

Phase 12 is mentioned for roadmap handoff only and is not implemented here.
