# BIELA Frontend Foundation

Phase 10 adds the first browser application to the existing monorepo. It is a
React + TypeScript + Vite workspace at `apps/frontend`, named
`@biela/frontend`. It consumes the released backend contract without changing
business semantics or database ownership.

## Architecture

```text
Browser :5173 → API Gateway :4000
                    ├─ server-side HTTP → ms-users :4001
                    └─ server-side HTTP → ms-autorepuesto :4002
```

The browser has one API base URL and one fetch implementation in
`src/api/api-client.ts`. Feature API files provide typed endpoint functions;
they do not call `fetch` themselves. The frontend never contacts internal
services or databases, and Vite does not hide direct calls behind a development
proxy.

TanStack Query owns server-state caching. A small React Auth Context owns only
the current identity and authentication lifecycle. React Router owns route and
permission guards. Backend permissions remain the source of authorization
truth; frontend checks improve navigation and UX but never replace server RBAC.

## Environment and startup

The only public browser setting is:

```bash
cp apps/frontend/.env.example apps/frontend/.env.local
# VITE_API_BASE_URL=http://localhost:4000
```

Never place credentials, JWTs, database URLs, or private service URLs in a
`VITE_*` variable: Vite embeds those values into public browser assets. The
Gateway `CORS_ORIGINS` allowlist must include the exact frontend origin. The
repository example and Gateway default include `http://localhost:5173`.

Start the backend services and frontend in separate terminals:

```bash
npm run dev:users
npm run dev:autorepuesto
npm run dev:gateway
npm run dev:frontend
```

Open `http://localhost:5173`. All API traffic must resolve from the configured
Gateway base URL.

## Authentication lifecycle

1. `/login` submits email/password to `POST /api/auth/login`.
2. On success, only `accessToken` is stored in `sessionStorage` under
   `biela.accessToken`; the returned safe user is held in memory.
3. On reload, the token is validated with `GET /api/auth/me` before protected
   content renders.
4. A `401` clears the invalid token, current user, and query cache, then route
   protection returns the user to login.
5. A network error, `502`, or `503` during restoration does not erase a
   potentially valid token. The UI explains that validation is unavailable and
   offers retry or explicit logout.
6. Logout clears the session token, user state, and all TanStack Query cache.

Credentials and token contents are never logged. `sessionStorage` deliberately
limits persistence to the current browser tab/session; it does not eliminate
XSS risk, so the application avoids raw HTML injection and keeps the token
behind one storage abstraction.

## Authorization and routes

The authenticated user may have multiple roles. Their permission strings are
flattened and deduplicated. Sidebar items are omitted when their read permission
is absent, and every restricted route independently applies the corresponding
permission guard.

| Route                                                    | Access                   | Phase 10 behavior                     |
| -------------------------------------------------------- | ------------------------ | ------------------------------------- |
| `/login`                                                 | public                   | real Gateway login                    |
| `/app`, `/app/dashboard`                                 | authenticated            | responsive shell and real dashboard   |
| `/app/products`, `/app/vehicles`, `/app/inventory`, etc. | matching read permission | transparent future-module placeholder |
| `/forbidden`                                             | authenticated            | permission denial explanation         |
| `/not-found`                                             | public                   | unknown-route recovery                |

The Phase 10 placeholders established the permission boundaries. Phase 11 now
implements the approved Catalog, Vehicle, Compatibility, Location, Inventory,
Movement, Transfer, and Search routes documented in
`frontend-phase-11-catalog-inventory.md`.

## Dashboard contract

The dashboard always requests public aggregate health from
`GET /api/system/health`. It requests `GET /api/commercial/summary` only when
the user has `commercial-summary.read`. Health and commercial queries have
independent loading, failure, and retry states. Displayed money comes from
backend decimal strings and is formatted without client-side business
calculation. The page explicitly identifies the commercial data as operational,
not accounting, profit, COGS, or financial statements.

## UI foundation

The global stylesheet defines BIELA color, spacing, radius, typography, focus,
and responsive tokens. Shared components provide buttons, alerts, loading,
empty states, and an application error boundary. The shell uses semantic
landmarks, keyboard-visible focus, labelled controls, a desktop sidebar, and a
mobile drawer dismissible by overlay or Escape. Spanish is the initial UI
language.

## Verification

Frontend-only gates:

```bash
npm run lint --workspace @biela/frontend
npm test --workspace @biela/frontend
npm run build --workspace @biela/frontend
```

Root `npm run lint`, `npm test`, and `npm run build` include the frontend through
npm workspaces. Before a release, also run the existing backend E2E, migration,
audit, and diff checks documented in `backend-release-readiness.md`.

Live verification must confirm login, reload restoration, logout, protected
route redirects, 403 handling, responsive navigation, health, permitted
commercial summary, and failed-request UI. Browser network evidence must show
that API requests go only to the configured Gateway and never to ports 4001 or 4002.

## Troubleshooting

- If Vite reports `EADDRINUSE`, inspect port `5173` before starting a duplicate
  process. An already-running frontend is not an application failure.
- If the browser reports a CORS error, verify that `CORS_ORIGINS` contains the
  exact browser origin, including scheme and port, then restart the Gateway.
- If Login shows temporary unavailability, check
  `http://localhost:4000/api/system/health`; do not delete the stored session
  merely because a dependency is temporarily unavailable.
- If a protected route returns to Login after reload, inspect the Gateway
  `/api/auth/me` response. A `401` means the token is invalid or expired;
  `502`/`503` indicates dependency availability instead.
- If the Dashboard omits commercial totals, confirm the user actually has
  `commercial-summary.read`. The frontend intentionally makes no request
  without it.
- If an unimplemented commercial or administration module shows a placeholder,
  it remains outside the Phase 11 operational scope.

## Scope boundary

Phase 10 delivers the frontend foundation, authentication, authorization,
application shell, and lightweight dashboard. Phase 11 adds Product, Vehicle,
Compatibility, Location, Inventory, Movement, Transfer, and Search screens.
Purchasing, Sales, Cash, settlement, and administration screens remain future
frontend work. Offline support, refresh
tokens, general accounting, fiscal invoicing, AI, and workshop workflows are
not added here.

## Next planned frontend phase

Phase 12 — Purchasing, Suppliers, Receiving, Purchase Returns and Accounts
Payable Frontend. This guide records the roadmap name only; Phase 12 is not
implemented here.
