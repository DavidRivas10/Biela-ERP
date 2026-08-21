# BIELA — FRONTEND PHASE 10.C

Frontend Phase 10.C replaces the purchasing placeholders with the operational Suppliers,
Purchases, Receiving, Purchase Returns, purchase-side settlement, Supplier
account, and Accounts Payable workflows. It consumes the released Phase 5–8
contracts without changing backend semantics, migrations, or ownership.

## Startup and architecture

Start the existing services and browser application in separate terminals:

```bash
npm run dev:users
npm run dev:autorepuesto
npm run dev:gateway
npm run dev:frontend
```

The browser at `http://localhost:5173` calls only the configured public Gateway
base URL, normally `http://localhost:4000`. Domain API modules reuse
`src/api/api-client.ts`; no component calls an internal service, database, or
Prisma client.

## Routes and permissions

| Route                                    | Purpose                                   | Route permission           |
| ---------------------------------------- | ----------------------------------------- | -------------------------- |
| `/app/purchasing/suppliers`              | Supplier list, filters, pagination        | `suppliers.read`           |
| `/app/purchasing/suppliers/new`          | Supplier creation                         | `suppliers.create`         |
| `/app/purchasing/suppliers/:id`          | Supplier detail and account               | `suppliers.read`           |
| `/app/purchasing/suppliers/:id/edit`     | Supplier editing                          | `suppliers.update`         |
| `/app/purchasing/purchases`              | Purchase list and filters                 | `purchases.read`           |
| `/app/purchasing/purchases/new`          | Multi-line Purchase creation              | `purchases.create`         |
| `/app/purchasing/purchases/:id`          | Purchase, Receiving and Return history    | `purchases.read`           |
| `/app/purchasing/purchases/:id/edit`     | DRAFT Purchase editing                    | `purchases.update`         |
| `/app/purchasing/purchases/:id/receipts` | Receipt draft creation                    | `purchases.receive`        |
| `/app/purchasing/purchases/:id/returns`  | Purchase Return draft creation            | `purchases.return`         |
| `/app/purchasing/purchases/:id/payments` | Purchase settlement                       | `purchases.read`           |
| `/app/purchasing/receipts/:id`           | Receipt detail and POST                   | `purchases.read`           |
| `/app/purchasing/returns/:id`            | Return, credit and Supplier Refund detail | `purchases.read`           |
| `/app/commercial/payables`               | Global operational Accounts Payable       | `commercial-payables.read` |

Mutation controls additionally require their exact backend permission:
`suppliers.create`, `suppliers.update`, `purchases.create`, `purchases.update`,
`purchases.receive`, `purchases.return`, `purchases.pay`, `payments.read`, and
`payments.reverse`. Selectors use `payment-methods.read` and
`cash-sessions.read`. Route guards are independent of sidebar visibility and
the backend RBAC guard remains authoritative.

## Suppliers and Purchases

Supplier screens support server search, active filtering, pagination, create,
edit, activation/deactivation, detail, and historical Supplier account. A
duplicate code or other backend `409` is displayed without clearing the form.
Deactivation does not remove historical documents.

Purchase screens support server pagination and Supplier, status, number,
Supplier-document, and date filters. Create/edit forms accept multiple distinct
Products. Duplicate Product lines are rejected before submission and remain
authoritatively rejected by the backend. Quantities are integers; unit cost,
discount, tax, line totals, document totals, obligations, Payments, and credits
remain decimal strings. The UI never uses floating-point arithmetic to derive
commercial truth.

DRAFT Purchases may be edited, confirmed, or cancelled according to the stable
contract. Confirmation has no stock effect. Every destructive or transactional
transition uses an accessible confirmation dialog. Detail displays the
backend-returned status, exact totals, receiving progress, Receipt/Return
history, due date, and settlement summary.

## Receiving and Purchase Returns

A Receipt draft chooses one active destination Location and positive quantities
up to the displayed remaining receivable quantity. Creating the draft does not
change stock. Explicit Receipt POST delegates all final validation and atomic
Inventory `IN` creation to the backend, then refreshes Purchase, history,
Inventory balance, Movement, and Search caches. Partial receiving is supported
by creating subsequent eligible Receipts.

A Purchase Return draft chooses a source Location per line and a positive
quantity within the server-reported received-minus-returned eligibility.
Creating the draft has no stock effect. Explicit Return POST delegates the
atomic Inventory `OUT` and negative-stock protection to the backend. The Return
detail displays only backend-derived Return value, refunded amount, and current
Supplier credit/refundable amount.

## Purchase Payments and Supplier Refunds

Purchase Payments can be partial or split across repeated operations and
methods. Supplier Refunds can likewise be partial or complete within the
backend-reported refundable value. For a `CASH` method, the form requires a
paginated OPEN Cash Session and explains the physical effect: Purchase Payment
decreases expected cash, while Supplier Refund increases it. Non-cash methods
omit the session and may carry an external reference.

Payment and Refund histories are independently server-paginated. Reversal asks
for a reason, requires an OPEN session for CASH compensation, shows a final
confirmation, and preserves the immutable original operation. There is no
optimistic financial update; Purchase, Payables, Supplier account, commercial
summary, and history queries are invalidated only after success. Overpayment,
over-refund, insufficient cash, closed session, duplicate POST, and invalid
state `409` responses remain visible without destroying form input.

## Accounts Payable

The Supplier detail embeds its server-derived account with documents,
settlement status, due date, overdue state, age, outstanding value, and Supplier
credit. Global Accounts Payable adds Supplier, settlement, overdue, due-date,
and document-date filters stored in the URL. Both tables use `{ data, summary,
meta, businessDate }` from the backend and server pagination. They are
operational views, not a general ledger or accounting statement.

## Selectors, pagination, and cache behavior

Supplier and Product selectors perform bounded server search and pagination;
Location selectors do the same. Payment Method and OPEN Cash Session selectors
render 20 records per page and expose subsequent server pages. The selected
record is fetched by ID when it is not on the current page. Thus no Frontend Phase 10.C
selector searches only a truncated first page and no unbounded catalog is
loaded.

Supplier, Purchase, Receipt, Return, Payment, Refund, Supplier-account, and
Payables lists all use stable TanStack Query key families. URL-backed list
filters reset page one; details and histories keep independent page state.
Mutations invalidate affected roots after success. Inventory and finance are
never optimistically mutated.

## Error, loading, and accessibility behavior

Tables expose loading, retryable error, empty, and pagination states. Forms use
labelled native controls, server error feedback, exact status badges, and keep
entered values after rejected mutations. Confirmation dialogs use
`role="alertdialog"`, focus the safe action, support Escape, and describe stock
or Cash effects. Wide tables are keyboard-focusable scroll regions; purchasing
line layouts collapse to one column on narrow screens.

## API modules and tests

- `src/api/suppliers-api.ts`: Supplier CRUD/lifecycle and Supplier account.
- `src/api/purchasing-api.ts`: Purchases, Receipts, and Purchase Returns.
- `src/api/purchasing-finance-api.ts`: methods, sessions, Payments, Supplier
  Refunds, reversals, and Payables.
- `src/types/purchasing.ts`: frontend-only Gateway response contracts.

Frontend regression covers Gateway-relative endpoint paths, exact decimal
payloads, lifecycle operations, partial Receipt/Return contracts, CASH and
non-cash settlement, reversal, Payables filters, route authorization, form
error preservation, confirmation behavior, cache invalidation, and discovery
outside selector page one.

Run:

```bash
npm run lint --workspace @biela/frontend
npm test --workspace @biela/frontend
npm run build --workspace @biela/frontend
```

Release verification additionally runs root lint, unit and E2E tests, build,
Prisma generate/deploy/status, dependency audit, `git diff --check`, and live
browser/network checks.

## Known boundaries

Frontend Phase 10.C does not add Sales/POS, Customer/Sale Return, full Cash management,
Accounts Receivable, accounting, fiscal invoicing, external payment providers,
AI, or workshop UI. It does not calculate stock, settlement, Supplier credit,
or authoritative money in the browser. Frontend Phase 10.D — Customers, Sales,
Sale Returns, Payments, Refunds and Accounts Receivable Frontend — is the next
implementation subphase of official Phase 10 and is not implemented by this
guide.
