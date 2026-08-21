# BIELA Architecture

BIELA — Base Integrada Empresarial de Logística Automotriz — is a traditional
ERP release candidate with one browser application, a database-free API
Gateway, and two database-owning NestJS services. The architecture below is the
implemented boundary, not a future-state design.

## 1. System context

```mermaid
flowchart LR
  User[ERP operator or administrator] --> Browser[BIELA React application]
  Browser -->|HTTPS/HTTP JSON| Gateway[API Gateway]
  Gateway --> Users[ms-users]
  Gateway --> Auto[ms-autorepuesto]
  Users --> Mongo[(MongoDB)]
  Auto --> Postgres[(PostgreSQL)]
```

The browser calls only the Gateway. `ms-users` owns identity and RBAC in
MongoDB. `ms-autorepuesto` owns operational ERP data and the complete Prisma
migration history in PostgreSQL. The Gateway owns no database and performs no
stock, money, Cash, settlement, or lifecycle calculation.

## 2. Local runtime and ports

```mermaid
flowchart TD
  Vite[React + TypeScript + Vite\nlocalhost:5173]
  Gateway[NestJS API Gateway\nlocalhost:4000]
  Users[NestJS ms-users\nlocalhost:4001]
  Auto[NestJS ms-autorepuesto\nlocalhost:4002]
  Mongo[(MongoDB 7\nlocalhost:27017)]
  PG[(PostgreSQL 16\nlocalhost:5432)]
  Vite -->|/api only| Gateway
  Gateway -->|REST forwarding| Users
  Gateway -->|REST forwarding| Auto
  Auto -->|token validation /auth/me| Users
  Users --> Mongo
  Auto --> PG
```

Only port 4000 is a public business API for the browser. Ports 4001 and 4002
are service boundaries, while 27017 and 5432 are database boundaries.

## 3. Authentication and RBAC

```mermaid
sequenceDiagram
  actor Operator
  participant UI as React UI
  participant G as Gateway
  participant U as ms-users
  participant A as ms-autorepuesto
  Operator->>UI: Submit email and password
  UI->>G: POST /api/auth/login
  G->>U: POST /auth/login
  U-->>G: JWT and safe User
  G-->>UI: JWT and permissions
  UI->>G: Business request with Bearer JWT
  G->>A: Forward request and Authorization
  A->>U: GET /auth/me
  U-->>A: Active identity and effective permissions
  A->>A: Enforce exact permission
  A-->>G: Result or 401/403
  G-->>UI: Preserve status and body
```

Frontend guards and navigation are usability controls only. Backend guards are
authoritative. The browser stores only the access token in session storage;
passwords are write-only and `passwordHash` is excluded from Mongo queries and
JSON output.

## 4. Purchasing and Inventory flow

```mermaid
flowchart LR
  Supplier --> Purchase[DRAFT Purchase]
  Purchase -->|confirm| Confirmed[CONFIRMED Purchase]
  Confirmed -->|no stock effect| Receipt[DRAFT Receipt]
  Receipt -->|POST atomically| In[Inventory IN]
  In --> Partial[PARTIALLY_RECEIVED or RECEIVED]
  Partial --> Return[DRAFT Purchase Return]
  Return -->|POST atomically| Out[Inventory OUT]
  Confirmed --> Payment[Purchase Payment]
  Return --> Refund[Supplier Refund]
  Payment --> AP[Derived Accounts Payable]
  Refund --> AP
```

Purchase confirmation never increases stock. Receipt POST and Purchase Return
POST are the only purchasing stock effects. Payments and Refunds affect
settlement and physical Cash when their Payment Method is CASH; they do not
change Inventory.

## 5. Sales and Inventory flow

```mermaid
flowchart LR
  Customer[Customer or walk-in] --> Sale[DRAFT Sale]
  Sale -->|no stock effect| Posted[POSTED Sale]
  Posted -->|same transaction| Out[Inventory OUT]
  Posted --> Payment[Sale Payment]
  Posted --> Return[DRAFT Sale Return]
  Return -->|POST atomically| In[Inventory IN]
  Return --> Refund[Customer Refund]
  Payment --> AR[Derived Accounts Receivable]
  Refund --> AR
```

A walk-in Sale deliberately has no Customer. Sale POST and Sale Return POST are
the stock-changing commands. Historical item prices are immutable snapshots;
the frontend never recomputes authoritative totals or outstanding balances.

## 6. Cash lifecycle and immutable ledger

```mermaid
stateDiagram-v2
  [*] --> OPEN: Open active Cash Register\nwith opening amount
  OPEN --> OPEN: Cash Payment / Refund
  OPEN --> OPEN: Manual IN / OUT
  OPEN --> OPEN: Reversal compensation
  OPEN --> CLOSED: Close with counted Cash
  CLOSED --> [*]

  note right of OPEN
    One OPEN Session per Register
    Expected Cash is server-derived
    Outflows cannot make Cash negative
  end note
```

Every physical-Cash effect appends a typed `CashMovement`. Reversal retains the
original Payment and appends its compensating movement. The ledger is
server-paginated and ordered newest-first; session summary clients request
`includeMovements=false` when they do not need ledger rows.

## 7. Catalog, fitment, and Inventory relationships

```mermaid
erDiagram
  ProductCategory ||--o{ Product : classifies
  ProductBrand ||--o{ Product : brands
  ProductCategory ||--o{ ProductAttributeDefinition : defines
  Product ||--o{ ProductAttributeValue : has
  ProductAttributeDefinition ||--o{ ProductAttributeValue : controls
  VehicleBrand ||--o{ VehicleModel : has
  VehicleModel ||--o{ Vehicle : has
  Product ||--o{ ProductCompatibility : fits
  Vehicle ||--o{ ProductCompatibility : accepts
  Product ||--o{ Inventory : stocked_as
  Location ||--o{ Inventory : stores
  Product ||--o{ InventoryMovement : traced_by
  Location ||--o{ InventoryMovement : source_or_destination
```

Product is catalog data only. Inventory is unique per Product + Location, is
never negative, and changes only through the Inventory Movement engine.
Compatibility is an explicit unique Product + Vehicle relation; deterministic
search uses catalog text and that existing relation, not AI or semantic search.

## Cross-service ownership

| Component | Owns | Must not own |
| --- | --- | --- |
| React application | forms, routing, accessible presentation, query cache | business totals, stock, Cash authority, direct service/database access |
| API Gateway | public `/api` facade, transport forwarding, aggregate health | database clients, repositories, business calculations |
| `ms-users` | users, roles, permissions, password hashes, JWT, MongoDB | PostgreSQL operational data |
| `ms-autorepuesto` | catalog, Inventory, commercial documents, settlement, Cash, PostgreSQL/Prisma | MongoDB identity storage |

## Consistency and concurrency

PostgreSQL commands use serializable transactions, bounded retry, conditional
stock decrements, row locks, unique business effects, and database constraints.
The lock order for financial work is document, optional Return, optional
Payment, then Cash Session. MongoDB role permissions are validated against the
controlled 54-code catalog. These protections remain backend-authoritative.

## Deferred architecture

General accounting, fiscal invoicing, Inventory valuation/COGS accounting,
external payment-provider integration, offline operation, advanced workshop or
multisite expansion, and AI are not part of this release candidate.
