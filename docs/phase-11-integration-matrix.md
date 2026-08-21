# BIELA Official Phase 11 Integration Matrix

All browser routes below are protected by authentication and call only the
Gateway `/api/...` surface. `Verified` means the route, typed client, Gateway
forwarder, backend controller permission, response shape, pagination where
applicable, and representative UI state were reviewed; principal cross-domain
paths were also exercised with generated `INT11-` data.

| Frontend module | Main frontend route | Gateway endpoint family | Owner | Required permission(s) | Result |
| --- | --- | --- | --- | --- | --- |
| Authentication | `/login` | `/api/auth/login`, `/api/auth/me` | `ms-users` | Login public; `/me` authenticated | Verified |
| Dashboard | `/app/dashboard` | `/api/system/health`, `/api/commercial/summary` | Gateway + both services / `ms-autorepuesto` | Health public; `commercial-summary.read` | Verified |
| Users | `/app/admin/users` | `/api/users` | `ms-users` | `users.read/create/update/activate/deactivate` by action | Verified |
| Roles | `/app/admin/roles` | `/api/roles` | `ms-users` | `roles.read`, `roles.manage` | Verified |
| Products | `/app/catalog/products` | `/api/products`, `/api/products/:id/inventory` | `ms-autorepuesto` | `products.read/create/update`; Inventory panel also `inventory.read` | Verified |
| Product categories | `/app/catalog/categories` | `/api/product-categories` | `ms-autorepuesto` | `products.read/create/update` by action | Verified |
| Product brands | `/app/catalog/brands` | `/api/product-brands` | `ms-autorepuesto` | `products.read/create/update` by action | Verified |
| Product attributes | `/app/catalog/attributes` | `/api/product-attribute-definitions` | `ms-autorepuesto` | `products.read/create/update` by action | Verified |
| Vehicles | `/app/vehicles` | `/api/vehicles` | `ms-autorepuesto` | `vehicles.read/create/update` by action | Verified |
| Vehicle brands/models | `/app/vehicles/brands`, `/app/vehicles/models` | `/api/vehicle-brands`, `/api/vehicle-models` | `ms-autorepuesto` | `vehicles.read/create/update` by action | Verified |
| Compatibility | `/app/compatibility` plus Product/Vehicle detail | `/api/compatibilities`, `/api/products/:id/vehicles`, `/api/vehicles/:id/products` | `ms-autorepuesto` | `compatibilities.read/manage`; related entity read | Verified |
| Locations | `/app/inventory/locations` | `/api/locations`, `/api/locations/:id/inventory` | `ms-autorepuesto` | `locations.read/create/update`; detail stock also `inventory.read` | Verified |
| Inventory balances | `/app/inventory` | `/api/inventory`, `/api/products/:id/inventory`, `/api/locations/:id/inventory` | `ms-autorepuesto` | `inventory.read` | Verified |
| Inventory movements | `/app/inventory/movements` | `/api/inventory/movements` | `ms-autorepuesto` | `inventory.read`; commands `inventory.adjust` | Verified |
| Transfers | `/app/inventory/transfers` | `/api/inventory/transfers` | `ms-autorepuesto` | `inventory.transfer` | Verified |
| Product search | `/app/search` | `/api/search/products` | `ms-autorepuesto` | `search.read` | Verified |
| Suppliers | `/app/purchasing/suppliers` | `/api/suppliers`, `/api/suppliers/:id/account` | `ms-autorepuesto` | `suppliers.read/create/update`; account `commercial-payables.read` | Verified |
| Purchases | `/app/purchasing/purchases` | `/api/purchases` | `ms-autorepuesto` | `purchases.read/create/update` by action | Verified |
| Receiving | Purchase detail/create and `/app/purchasing/receipts/:id` | `/api/purchases/:id/receipts`, `/api/purchase-receipts/:id` | `ms-autorepuesto` | `purchases.receive`; detail `purchases.read` | Verified |
| Purchase returns | Purchase detail/create and `/app/purchasing/returns/:id` | `/api/purchases/:id/returns`, `/api/purchase-returns/:id` | `ms-autorepuesto` | `purchases.return`; detail `purchases.read` | Verified |
| Purchase payments | `/app/purchasing/purchases/:id/payments` | `/api/purchases/:id/payments`, `/api/payments/:id/reverse` | `ms-autorepuesto` | Create `purchases.pay`; history `payments.read`; reverse `payments.reverse`; selectors use their read permissions | Verified |
| Supplier refunds | Purchase Return detail/payments | `/api/purchase-returns/:id/refunds`, `/api/payments/:id/reverse` | `ms-autorepuesto` | Create `purchases.pay`; history `payments.read`; reverse `payments.reverse` | Verified |
| Accounts Payable | `/app/commercial/payables` | `/api/commercial/payables`, `/api/suppliers/:id/account` | `ms-autorepuesto` | `commercial-payables.read` | Verified |
| Customers | `/app/sales/customers` | `/api/customers`, `/api/customers/:id/account` | `ms-autorepuesto` | `customers.read/create/update`; account `commercial-receivables.read` | Verified |
| Sales | `/app/sales` | `/api/sales` | `ms-autorepuesto` | `sales.read/create/update/post` by action | Verified |
| Sale returns | `/app/sales/:id/returns`, `/app/sales/returns/:id` | `/api/sales/:id/returns`, `/api/sale-returns/:id` | `ms-autorepuesto` | `sales.return`; detail `sales.read` | Verified |
| Sale payments | `/app/sales/:id/payments` | `/api/sales/:id/payments`, `/api/payments/:id/reverse` | `ms-autorepuesto` | Create `payments.create`; history `payments.read`; reverse `payments.reverse` | Verified |
| Customer refunds | `/app/sales/returns/:id/refunds` | `/api/sale-returns/:id/refunds`, `/api/payments/:id/reverse` | `ms-autorepuesto` | Create `payments.create`; history `payments.read`; reverse `payments.reverse` | Verified |
| Accounts Receivable | `/app/commercial/receivables` | `/api/commercial/receivables`, `/api/customers/:id/account` | `ms-autorepuesto` | `commercial-receivables.read` | Verified |
| Payment methods | Financial forms | `/api/payment-methods` | `ms-autorepuesto` | `payment-methods.read`; administration `payment-methods.manage` | Verified |
| Cash registers | `/app/cash/registers` | `/api/cash-registers` | `ms-autorepuesto` | `cash-registers.read/manage` | Verified |
| Cash sessions | `/app/cash/sessions` | `/api/cash-sessions`, `/api/cash-registers/:id/sessions/open` | `ms-autorepuesto` | `cash-sessions.read/open/close` by action | Verified |
| Cash movements | `/app/cash/movements` and Session detail | `/api/cash-movements`, `/api/cash-sessions/:id/movements` | `ms-autorepuesto` | `cash-movements.read/create` | Verified |

## Contract notes

- Purchasing financial creation intentionally uses backend permission
  `purchases.pay`; `payments.create` is the sales-side creation permission and
  is not added to purchase controls.
- Financial history uses `payments.read`; reversal controls use
  `payments.reverse`. CASH selectors additionally require
  `payment-methods.read` and `cash-sessions.read`.
- Backend authorization is evaluated on every request. A Role edit therefore
  changes backend authority immediately; a currently rendered frontend identity
  reflects it after its next `/api/auth/me` refresh/reload.
- Roles are the backend-controlled small list. Every high-cardinality
  operational dataset uses bounded server pagination and/or server search.
- No missing Gateway family was found. Gateway controllers forward method,
  path, query, body, bearer token, and upstream status; they contain no Inventory,
  settlement, Cash, or persistence logic.
