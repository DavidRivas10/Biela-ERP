# BIELA — FRONTEND PHASE 10.D

## Customers, Sales, Sale Returns, Payments, Refunds and Accounts Receivable Frontend

Frontend Phase 10.D replaces the Customer, Sales, Sale Return, sales-side settlement, and
Accounts Receivable placeholders with operational React workflows. The browser
continues to call only the Gateway under `/api`; no backend authorization,
schema, migration, or business formula changed.

## Routes

| UI route | Purpose | Route permission |
| --- | --- | --- |
| `/app/sales/customers` | Customer list | `customers.read` |
| `/app/sales/customers/new` | Create Customer | `customers.create` |
| `/app/sales/customers/:id` | Customer detail/account | `customers.read` |
| `/app/sales/customers/:id/edit` | Edit Customer | `customers.update` |
| `/app/sales` | Sales list | `sales.read` |
| `/app/sales/new` | Create DRAFT Sale | `sales.create` |
| `/app/sales/:id` | Sale detail | `sales.read` |
| `/app/sales/:id/edit` | Edit DRAFT Sale | `sales.update` |
| `/app/sales/:id/returns` | Create DRAFT Sale Return | `sales.return` |
| `/app/sales/returns/:id` | Sale Return detail/post | `sales.read` |
| `/app/sales/:id/payments` | Sale Payment history/create | `sales.read` |
| `/app/sales/returns/:id/refunds` | Customer Refund history/create | `sales.read` |
| `/app/commercial/receivables` | Global operational receivables | `commercial-receivables.read` |

Mutation controls apply their own exact permission in addition to route access.
Customer lifecycle uses `customers.update`; Sale posting uses `sales.post`;
return creation/posting uses `sales.return`; financial creation uses
`payments.create`; financial history uses `payments.read`; reversal controls use
`payments.reverse`. Payment Method and OPEN Cash Session selectors require
`payment-methods.read` and `cash-sessions.read` respectively.

## Lifecycle and Inventory

Saving a Sale creates or updates only a `DRAFT`. `POST /api/sales/:id/post` is
the explicit irreversible transition that invokes the backend Inventory `OUT`
engine. Cancel is available only for a DRAFT and has no stock effect.

A Sale Return is also created as a DRAFT. The UI derives selectable quantities
from the backend's `netQuantity` but the backend revalidates eligibility under
lock. Only `POST /api/sale-returns/:id/post` invokes Inventory `IN`. The UI does
not optimistically change balances or movement history.

## Exact money and settlement

Sale prices, discounts, taxes, totals, payment amounts, tendered amounts, change,
refund values, and balances remain decimal strings. React formats values for
display but does not calculate authoritative line totals, document totals,
change, outstanding balances, settlement classifications, or refundable limits.

Sale Payments and Customer Refunds can be partial and repeated while the backend
allows them. CASH requires an active Payment Method of kind `CASH` and an
existing OPEN Cash Session. Only Sale Payments accept `tenderedAmount`; the
returned `changeAmount` is authoritative. Reversals preserve history and may
require a currently OPEN Cash Session when the original operation was CASH.

## Pagination and selectors

All operational lists and histories send `page` and `limit` to the Gateway and
render the returned pagination metadata. Customer, Product, and Location
selectors render at most 20 current matches and support server search plus
server pagination. Payment Method and OPEN Cash Session selectors are also
server-paginated. If an already selected record is outside the current result
page, its detail endpoint preserves it in the control. Therefore no selector is
limited to the first backend page and no catalog is loaded without a bound.

The Sales list sends Customer, Product, status, number, and date filters to the
backend. Receivables send Customer, settlement, overdue, due-date, and document-
date filters to the derived backend view. Walk-in Sales remain visible in the
global view and are not assigned to a fabricated Customer account.

## Cache behavior

There are separate query-key roots for Customers, Sales, Returns, Payments,
Refunds, Receivables, and Customer accounts. Mutations are not optimistic:

- Customer mutations invalidate Customer lists/details and related accounts.
- Sale post invalidates Sale, Inventory, Movement, and Receivables data.
- Sale Return post invalidates Sale/Return, Inventory, Movement, Receivables,
  and account data.
- Payment, Refund, and reversal operations invalidate financial histories, Sale
  and Return details, Receivables, and Customer accounts.

## Scope boundary

Frontend Phase 10.D does not add general accounting, fiscal invoicing, external processors,
inventory valuation/COGS, workshop, AI, offline synchronization, or a full Cash
management UI. The next planned subphase is BIELA — FRONTEND PHASE 10.E — Cash
Registers, Cash Sessions, Cash Movements and Remaining Frontend Completion.
After 10.E comes official Phase 11 — Complete Frontend ↔ Backend Integration.
