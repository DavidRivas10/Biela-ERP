# BIELA Frontend Phase 11

Phase 11 replaces the Catalog, Vehicle, Compatibility, Location, Inventory,
Movement, Transfer, and Product Search placeholders with operational React
workflows. The browser continues to use only the API Gateway at port 4000;
server validation, RBAC, deterministic ordering, compatibility truth, and stock
balances remain authoritative.

## Startup

After the root environment, databases, migrations, and administrator seed are
ready, start each process in a separate terminal:

```bash
npm run dev:users
npm run dev:autorepuesto
npm run dev:gateway
npm run dev:frontend
```

Open `http://localhost:5173`. Configure only the public
`VITE_API_BASE_URL` described in `frontend-foundation.md`; never expose a
credential or internal service URL through a `VITE_*` variable.

## Routes and permissions

| Route                            | Purpose                                        | Route permission       |
| -------------------------------- | ---------------------------------------------- | ---------------------- |
| `/app/catalog/products`          | Product list and filters                       | `products.read`        |
| `/app/catalog/products/new`      | Product creation                               | `products.create`      |
| `/app/catalog/products/:id`      | Product, attributes, stock, and fitment detail | `products.read`        |
| `/app/catalog/products/:id/edit` | Product editing                                | `products.update`      |
| `/app/catalog/categories`        | Product Categories                             | `products.read`        |
| `/app/catalog/brands`            | Product Brands                                 | `products.read`        |
| `/app/catalog/attributes`        | Category-specific attribute definitions        | `products.read`        |
| `/app/vehicles`                  | Vehicle list and filters                       | `vehicles.read`        |
| `/app/vehicles/new`              | Vehicle creation                               | `vehicles.create`      |
| `/app/vehicles/:id`              | Vehicle and compatible Product detail          | `vehicles.read`        |
| `/app/vehicles/:id/edit`         | Vehicle editing                                | `vehicles.update`      |
| `/app/vehicles/brands`           | Vehicle Brands                                 | `vehicles.read`        |
| `/app/vehicles/models`           | Brand-owned Vehicle Models                     | `vehicles.read`        |
| `/app/compatibility`             | Product ↔ Vehicle relations                    | `compatibilities.read` |
| `/app/inventory`                 | Product + Location balances                    | `inventory.read`       |
| `/app/inventory/locations`       | Physical Locations                             | `locations.read`       |
| `/app/inventory/movements`       | Ledger and manual commands                     | `inventory.read`       |
| `/app/inventory/transfers`       | Atomic transfer workflow                       | `inventory.transfer`   |
| `/app/search`                    | Deterministic Product search                   | `search.read`          |

Mutation controls are independently hidden unless the identity has the exact
backend permission: `products.create`, `products.update`, `vehicles.create`,
`vehicles.update`, `compatibilities.manage`, `locations.create`,
`locations.update`, `inventory.adjust`, or `inventory.transfer`. Frontend
checks improve UX; the Gateway and service guards make the authorization
decision.

Legacy `/app/products` and `/app/locations` links redirect to the canonical
Phase 11 route families.

## Data and workflow behavior

- Product Category, Product Brand, Vehicle Brand, Vehicle Model, and attribute
  definition endpoints return complete, server-ordered arrays. Operational
  lists use the shared `{ data, meta }` server-pagination representation.
- Product values are rendered from controlled attribute definitions for the
  selected category. Required values and `STRING`, `NUMBER`, or `BOOLEAN`
  controls follow the public DTO, while final validation remains server-side.
- `defaultSalePrice` stays a decimal string from form to request. It is a
  current suggestion and never recalculates historical Sale data.
- Compatibility creates one explicit Product + Vehicle link. A repeated pair
  surfaces the backend `409`; lifecycle changes use the supported `PATCH`
  active state and never invent deletion.
- Location codes and catalog codes are sent to backend normalization and
  uniqueness rules. Deactivation keeps history.
- Inventory balances are read-only. `INITIAL`, manual `IN`, `OUT`, and target
  `ADJUSTMENT` are public commands protected by `inventory.adjust`.
  `ADJUSTMENT` accepts a non-negative target and requires a reason.
- Transfer review names Product, source, destination, quantity, and current
  server balances. Confirmation sends one `TRANSFER`
  command; the server performs the atomic stock check and ledger write.
- Search sends Product, stock, and Vehicle filters to
  `GET /api/search/products`. The client renders the returned order unchanged,
  including exact-code precedence and stable pagination.

## Client architecture

Feature modules in `src/api` reuse the centralized authenticated client and
only contain `/api/...` Gateway paths. `src/query/query-keys.ts` owns stable key
factories for catalog, Vehicle, Compatibility, Location, Inventory, Movement,
and Search data. Mutations invalidate only affected domain roots; stock is
never optimistically changed.

Important list/search filters and pagination live in URL query parameters.
Changing a significant filter resets page to 1. Shared ERP components provide
semantic tables, pagination, labelled fields, loading/error/empty states,
mutation feedback, and keyboard-dismissible `alertdialog` confirmation.

## Verification

```bash
npm run lint --workspace @biela/frontend
npm test --workspace @biela/frontend
npm run build --workspace @biela/frontend
```

Release verification additionally requires root lint/test/build, backend E2E,
Prisma generate/deploy/status, dependency audit, `git diff --check`, live
browser workflows, and browser network inspection. Live traffic must target
only the configured Gateway origin and never ports 4001, 4002, 5432, or 27017.

## Known boundaries

High-cardinality Product and Location selectors use bounded, server-side search
with server pagination. Vehicle selectors use the stable Brand/Model/Year/Engine
filters and server pagination. Each selector renders at most 20 query results at
a time while preserving the selected entity, so records outside the initial page
remain discoverable. Product-detail Inventory and compatible-Vehicle tables, and
the Vehicle-detail compatible-Product table, also expose their independent
server pagination. Controlled Product Category/Brand and Vehicle Brand/Model
catalogs retain their existing full-list backend contracts; Phase 11 does not
alter those stable response shapes. Phase 11 does not add
Purchasing, Suppliers, Sales/POS, Customers, Cash, settlement, accounting,
valuation/COGS, fiscal invoicing, provider integration, AI, or workshop UI.
The current Product PATCH DTO accepts a decimal string but not `null`, so a
previously defined `defaultSalePrice` can be changed but not cleared by this UI.

## Next planned frontend phase

Phase 12 — Purchasing, Suppliers, Receiving, Purchase Returns and Accounts
Payable Frontend. This is a roadmap label only and is not implemented here.
