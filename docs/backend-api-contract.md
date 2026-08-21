# BIELA Backend API Contract

This document summarizes the stable public contract implemented through Backend
Phase 8 and verified in Phase 9. Swagger is the detailed schema source. The
Phase 10 React application uses only the API Gateway at `http://localhost:4000`.

Unless explicitly marked public, routes require `Authorization: Bearer <token>`.
The Gateway forwards authorization, path parameters, query parameters, bodies,
and upstream status codes without owning business logic or persistence.

## Public route families

| Family                  | Gateway routes                                                                                                        | Main permissions                                                | Important semantics                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth                    | `POST /api/auth/login`, `GET /api/auth/me`                                                                            | authenticated identity                                          | Login is public. Responses never expose `passwordHash`; inactive users and invalid/expired tokens are rejected.                                                                                              |
| Users and roles         | `/api/users`, `/api/roles`                                                                                            | `users.*`, `roles.*`                                            | Users and roles are MongoDB-owned by `ms-users`; role permissions are controlled strings.                                                                                                                    |
| Product catalog         | `/api/products`, `/api/product-categories`, `/api/product-brands`, `/api/product-attribute-definitions`               | `products.*`                                                    | Product data is catalog-only. Attributes are controlled and relational. `defaultSalePrice` is a current suggestion, not historical Sale truth.                                                               |
| Vehicles                | `/api/vehicles`, `/api/vehicle-brands`, `/api/vehicle-models`                                                         | `vehicles.*`                                                    | Vehicle Brand → Model → year/engine variant is explicit and filterable.                                                                                                                                      |
| Compatibility           | `/api/compatibilities`, `/api/products/:id/vehicles`, `/api/vehicles/:id/products`                                    | `compatibilities.*`, relevant read permissions                  | Fitment is the unique explicit Product + Vehicle relation; it is not inferred.                                                                                                                               |
| Locations               | `/api/locations`                                                                                                      | `locations.*`                                                   | Physical storage locations use stable IDs, unique codes, and soft active state.                                                                                                                              |
| Inventory               | `/api/inventory`, `/api/inventory/movements`, `/api/products/:id/inventory`, `/api/locations/:id/inventory`           | `inventory.read`, `inventory.adjust`, `inventory.transfer`      | Inventory is unique by Product + Location and cannot be negative. There is no direct balance-overwrite endpoint. INITIAL/IN/OUT/ADJUSTMENT/TRANSFER append traceable movement history.                       |
| Search                  | `GET /api/search/products`                                                                                            | `search.read`                                                   | Deterministic PostgreSQL code/name and explicit Compatibility search with stable pagination; no semantic/external search.                                                                                    |
| Suppliers               | `/api/suppliers`                                                                                                      | `suppliers.*`                                                   | Soft deactivation blocks new work without invalidating history.                                                                                                                                              |
| Purchasing              | `/api/purchases`, nested `/receipts` and `/returns`, `/api/purchase-receipts/:id`, `/api/purchase-returns/:id`        | `purchases.*`                                                   | Purchase: DRAFT → CONFIRMED/PARTIALLY_RECEIVED/RECEIVED or CANCELLED. Confirmation has no stock effect. Receipt POST is Inventory IN; Purchase Return POST is Inventory OUT. Posted documents are immutable. |
| Customers               | `/api/customers`                                                                                                      | `customers.*`                                                   | Customer is optional on a Sale; a null Customer is a walk-in Sale. Deactivation preserves history.                                                                                                           |
| Sales                   | `/api/sales`, nested `/returns`, `/api/sale-returns/:id`                                                              | `sales.*`                                                       | Sale DRAFT has no stock effect; POST is Inventory OUT. Sale Return POST is Inventory IN. `SaleItem.unitPrice` is the historical price snapshot.                                                              |
| Payment methods         | `/api/payment-methods`                                                                                                | `payment-methods.*`                                             | Kind is one of CASH, CARD, BANK_TRANSFER, OTHER. Kind cannot change after use. Inactive methods retain history but reject new operations.                                                                    |
| Cash registers/sessions | `/api/cash-registers`, `/api/cash-sessions`, `GET /api/cash-movements`                                                     | `cash-registers.*`, `cash-sessions.*`, `cash-movements.*`       | One OPEN session per register. Cash is derived from opening amount plus immutable typed movements. Movement reads are paginated newest-first; closing snapshots expected, counted, and difference amounts.   |
| Payments/refunds        | nested `/payments` and `/refunds`, `/api/payments/:id`, `/api/payments/:id/reverse`                                   | `payments.*`; purchase-side writes also require `purchases.pay` | Payment status is POSTED or REVERSED. Reversal preserves the original and appends a compensating Cash movement for CASH. Financial operations never mutate Inventory.                                        |
| Receivables/payables    | `/api/customers/:id/account`, `/api/suppliers/:id/account`, `/api/commercial/receivables`, `/api/commercial/payables` | `commercial-receivables.read`, `commercial-payables.read`       | Operational balances are derived from posted documents and active Payment rows. Settlement is UNPAID, PARTIALLY_PAID, or PAID. Walk-in receivables remain globally visible.                                  |
| Commercial summary      | `GET /api/commercial/summary`                                                                                         | `commercial-summary.read`                                       | Reports operational AR/AP, overdue, OPEN sessions, and expected physical Cash. It is not profit, COGS, valuation, or accounting.                                                                             |
| Health                  | `GET /health`, `GET /api/system/health`                                                                               | public                                                          | `/health` checks the Gateway process. Aggregate health is `ok` only when both downstream services report healthy; dependency failures produce `degraded`.                                                    |

## Shared representation

Paginated endpoints return:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "pages": 0 }
}
```

`page` starts at 1 and `limit` is bounded to 1–100. Ordering is deterministic
within each family. Commercial lists additionally return an exact aggregate
`summary` and `businessDate`.

`GET /api/cash-movements` requires `cash-movements.read` and supports bounded
`page`/`limit` plus `cashSessionId`, `cashRegisterId`, `type`, `paymentId`,
`reference`, `createdFrom`, and `createdTo`. `reference` matches a Payment or
related document UUID, Payment number, or external Payment reference. Results
include their Cash Session/Register and optional Payment/Payment Method in the
same query and order by `createdAt DESC, id DESC`.

`GET /api/cash-sessions/:id/summary` remains backward-compatible: omitting
`includeMovements` retains the existing embedded movement history. Clients that
only need exact summary totals and expected Cash may send
`includeMovements=false`; the response keeps the summary shape with an empty
`movements` array while database aggregation avoids an ever-growing ledger
payload.

Money is submitted as decimal strings and stored as PostgreSQL `NUMERIC` through
Prisma Decimal. JSON responses serialize exact monetary values as strings (for
example, `"100.00"`; Prisma may omit insignificant trailing zeroes on some
model responses). Clients must not use binary floating-point arithmetic for
business calculations. Quantities are integers.

Timestamps are ISO-8601-compatible JSON dates. Document and due dates are
PostgreSQL `DATE` values. Overdue means an exact outstanding amount exists and
the due date is before the current calendar date in `America/Tegucigalpa` (or
the explicitly configured process `TZ`). A settled document is never overdue.

DTO validation strips no unknown business fields silently: global validation
uses transformation, whitelisting, and unknown-field rejection. Actor IDs,
lifecycle status, posting/reversal timestamps, Inventory balances, expected
Cash, and closing snapshots are server-controlled.

## Errors and dependencies

Expected validation/auth/business results preserve HTTP 400, 401, 403, 404, and
409 across the Gateway. A Gateway network/timeout failure is normalized to 502.
When `ms-autorepuesto` cannot validate a bearer token because `ms-users` is
unavailable, it returns 503 rather than misreporting invalid credentials. Error
responses do not expose database SQL, credentials, or stack traces.
