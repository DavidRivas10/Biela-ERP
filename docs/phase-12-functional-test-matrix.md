# BIELA Official Phase 12 Functional Test Matrix

All mutable test entities use `FUNC12-` prefixes. “Gateway” below means the
public `http://localhost:4000/api` contract used by the browser.

| Area | Scenario | Preconditions | Steps | Expected | Observed | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Repository | Clean Phase 11 baseline | `main`, Phase 11 complete | Inspect status/HEAD and roadmap docs | No hidden pending implementation | Clean at baseline; Phase 11 commit present | PASS |
| Platform | Health | Four apps running | Request Gateway, users, autorepuesto, frontend | All healthy | All returned 200 | PASS |
| Auth | Admin login | Seed admin available from ignored `.env` | POST login through Gateway | Token + safe User | 200; no credential hash | PASS |
| Auth | Refresh restoration | Valid browser token | Reload authenticated deep link | Restore identity and route | `/auth/me` restored route | PASS |
| Auth | Invalid/no token | Invalid/absent token | Request `/auth/me`; open protected UI | 401, token cleared, Login | Observed | PASS |
| Auth | Logout | Logged-in browser | Press Salir; reopen protected URL | Token/cache cleared; Login | Token absent; Login | PASS |
| Auth | 403 semantics | Limited valid User | Attempt forbidden mutation/direct route | Preserve session; forbidden UX | 403 then `/auth/me` 200; `/forbidden` | PASS |
| RBAC | Minimal Role | Role with `products.read` | Read Products; mutate category; read Sales | 200, 403, 403 | 200, 403, 403 | PASS |
| RBAC | Live Role update | Existing token, Role edited | Add `sales.read`; retry Sales | New permission effective | 200 without re-login | PASS |
| Users | Create/search/page 2 | >20 Users | Create controlled User; server search; page 2 | Safe response; record reachable | 38 total; page 2 had 18 distinct | PASS |
| Users | Deactivate/reactivate | Active controlled User | Deactivate, use token/login, reactivate/login | 401 while inactive; restore after activate | Observed | PASS |
| Catalog | Category/Brand/Attribute/Product CRUD | Admin | Create realistic catalog graph; update Product | Persist validated data | Product created; current price updated to 29.99 | PASS |
| Vehicles | Brand/Model/Vehicle CRUD | Admin | Create graph | Deterministic hierarchy | Persisted | PASS |
| Compatibility | Create and duplicate | Product + Vehicle | Create same pair twice | First success, duplicate 409 | 201 then 409 | PASS |
| Search | Code | Active controlled Product | Search exact/partial code | One deterministic match | One match | PASS |
| Search | Vehicle + name + stock | Compatibility + stock | Combine q, Vehicle, inStock | Compatible in-stock Product | One controlled match | PASS |
| Search | Empty | Nonexistent term | Search | Explicit empty result | 0 rows, total 0 | PASS |
| Selectors | Record after initial Product page | 42 active Products | Search page-2 Product in Sale form | Server search returns/selects it | Gateway query returned exact option | PASS |
| Selectors | Record after initial Location page | 48 active Locations | Search page-2 Location in Sale form | Server search returns/selects it | Gateway query returned exact option | PASS |
| Selectors | Record after initial Customer page | 23 active Customers | Search page-2 Customer in Sale form | Server search returns/selects it | Gateway query returned exact option | PASS |
| Inventory | Initial balances | Product + two Locations | INITIAL 100 and 50 | Total 150 | A100/B50 | PASS |
| Inventory | Draft/confirm no stock | Draft Purchase | Read before/after confirm | No stock effect | 150/150 | PASS |
| Inventory | Receipt effects | Confirmed Purchase 10 | Post Receipt 4 then 6 | 154 then 160; Purchase RECEIVED | Observed final 160 | PASS |
| Inventory | Purchase Return | Received quantity | Draft then post Return 2 | Draft no effect; post -2 | 160 -> 158 | PASS |
| Inventory | Sale/Return | Stock available | Draft/post Sale4; draft/post Return1 | 0/-4/0/+1 | 158 -> 154 -> 155 | PASS |
| Inventory | Transfer conservation | A and B stocked | Transfer 2 A to B | Total unchanged | A -2, B +2, total 155 | PASS |
| Inventory | Invalid Transfer | Same source/destination | Submit command | 400, no effect | 400 | PASS |
| Inventory | Negative/concurrent protection | Quantity unavailable/invalid | OUT -1 and excessive Cash OUT; run embedded concurrent-OUT regression | Reject atomically; concurrent OUT cannot make stock negative | 400/409 live; embedded Inventory concurrency PASS | PASS |
| Purchasing | Multi-line monetary contract | Supplier/Product | Create Purchase with exact strings | Exact snapshots | `10.1000` line snapshot | PASS |
| Purchasing | Partial receipt | Confirmed Purchase | Receive 4 of 10 | PARTIALLY_RECEIVED | Observed | PASS |
| Purchasing | Over-receipt | 4 already received | Attempt 7 | 409, no partial effect | 409 | PASS |
| Purchasing | Purchase payments | Obligation 101.00 | Cash 40.40 + Bank 60.60 | Fully settled; Cash effect only Cash | Observed | PASS |
| Purchasing | Payment reversal | Active Bank Payment | Reverse and replace | History retained; obligation reopens/recloses | Observed | PASS |
| Purchase Returns | Eligibility and stale POST | Received 10 | Attempt 11; post 2; run repeated/stale Return regression | 409 then successful 2; repeated/stale POST rejected without another effect | Live eligibility PASS; regular Purchasing E2E stale/repeat PASS | PASS |
| Supplier Refunds | Split refund | Posted Return 20.20 | Cash 10.10 + Bank 10.10 | Exact credit settlement | Observed | PASS |
| Supplier Refunds | Over-refund/reversal/concurrency | Fully refunded Return | Attempt .01; reverse/replace Bank; run concurrent Supplier Refund regression | 409; traceable reopen/reclose; no concurrent excess credit | Live flow PASS; dedicated commercial concurrency PASS | PASS |
| AP | Past partial/full settlement | Past-due Purchase | Pay 4.10 then 6.00 | PARTIALLY_PAID 6.00; overdue disappears | Observed | PASS |
| AP | Current/future due filters | Outstanding Purchases | Filter dueFrom/dueTo | One 10.10 each | Observed | PASS |
| AP | Supplier account page 2 | 25 scoped documents | Fetch pages 1/2 limit20 | 20 + 5 distinct | Observed | PASS |
| AP | Global scoped page 2 | 23 outstanding scoped docs | Fetch pages 1/2 | 20 + 3 distinct | Observed | PASS |
| Sales | Registered Sale | Active Customer/Product | Draft, post 4 | Walk-in false; stock -4 | Observed | PASS |
| Sales | Walk-in Sale | No Customer | Create/post 1 | Explicit null Customer; Receivable global only | Observed | PASS |
| Sales | Split payment/change | Sale total 79.96 | Cash amount30 tendered40 + Bank49.96 | Paid; change10; Cash ledger +30 | Observed | PASS |
| Sales | Overpayment/reversal | Fully paid Sale | Attempt .01; reverse/replace Bank | 409; history retained | Observed | PASS |
| Sale Returns | Eligibility | Posted Sale4 | Attempt5; post1 | 409 then stock +1 | Observed | PASS |
| Customer Refunds | Split refund | Return value19.99 | Cash10.10 + Bank9.89 | Exact settlement | Observed | PASS |
| Customer Refunds | Over-refund/reversal/concurrency | Fully refunded Return | Attempt .01; reverse/replace Bank; run concurrent Refund regression | 409; history retained; no concurrent over-refund | Live flow PASS; dedicated finance concurrency PASS | PASS |
| AR | Past partial/full settlement | Past-due Sale | Pay9.99 then10.00 | PARTIALLY_PAID 10.00; overdue disappears | Observed | PASS |
| AR | Current/future due filters | Outstanding Sales | Filter dueFrom/dueTo | One 19.99 each | Observed | PASS |
| AR | Customer account page 2 | 25 scoped documents | Fetch pages1/2 limit20 | 20 + 5 distinct | Observed | PASS |
| AR | Global scoped page 2 | 23 outstanding scoped docs | Fetch pages1/2 | 20 + 3 distinct | Observed | PASS |
| Cash | Open/duplicate open | Active Register | Open 500; repeat | One OPEN; duplicate 409 | 201/409 | PASS |
| Cash | Manual movement | Open Session | IN3.33, OUT1.11 | Immutable entries; expected adjusted | Observed | PASS |
| Cash | Insufficient outflow | Expected Cash bounded | Attempt 999999.99 | 409, no entry | Observed | PASS |
| Cash | Summary bounded | Session with movements | `includeMovements=false` | Zero payload movements; same expected Cash | 0 rows; 491.82 | PASS |
| Cash | Close/repeat/concurrent close | Expected 491.82 | Close 491.82; repeat; move; run concurrent-close regression | Difference0; repeat/move 409; only one concurrent close transition | Live repeat PASS; dedicated finance concurrency PASS | PASS |
| Cash | UI mobile operation | Fresh Session 10.00 | UI IN1.00; close11.00 | Expected11, difference0 | Observed | PASS |
| Cash ledger | Pagination after 100 | 141 movements | Fetch pages1,2,6 limit20 | All reachable, disjoint, newest-first | Observed | PASS |
| Cash ledger | Filters | Controlled movement | Filter Session/Register/type/reference/date | Only matching rows | 6/6/1/1/30 totals | PASS |
| Cash ledger | N+1 | Ledger UI | Inspect browser requests | No per-row Session fetches | One ledger + bounded Register requests | PASS |
| Dashboard | Global state | Completed scoped run | Read summary before/after settled extras | No client-derived totals; stable after net-zero docs | Stable 881.81/298.64/500.00 | PASS |
| Historical | Monetary snapshots | Update current Product price | Re-read received Purchase/posted Sale | Old prices unchanged | 10.1000/19.9900 retained | PASS |
| Historical | Inactive master records | Historical documents exist | Deactivate each master; active list/detail | Active selector excludes; detail remains | Observed | PASS |
| Concurrency | Sale double post | One DRAFT Sale | Two parallel POST commands | One success/one conflict; stock -1 | `[201,409]`, stock -1 | PASS |
| Concurrency | Payment/refund duplicate or stale | One outstanding Sale; eligible Returns | Two parallel full Payments; run concurrent Customer/Supplier Refund regressions | One active Payment; Refunds cannot exceed eligibility/credit | Payment `[201,409]`; dedicated finance/commercial regressions PASS | PASS |
| Concurrency | Receipt/Return repeated or stale POST | One DRAFT Receipt; received/returnable stock | Two parallel Receipt POST commands; run same-Receipt and competing/stale Return regressions | One Receipt stock increment; repeated/stale Returns have no second effect | Receipt `[201,409]`, stock +1; purchasing dedicated/regular regressions PASS | PASS |
| Concurrency | Cash open/close races | Active fresh Register; OPEN Session | Two parallel opens; run concurrent-close regression | Exactly one OPEN and one close transition | Open `[201,409]`; finance concurrent close PASS | PASS |
| Errors | Validation/not found/conflict | Authenticated admin | Invalid quantity, missing UUID, duplicate commands | 400/404/409 with stable UI | Observed | PASS |
| Errors | Spanish Cash rejection | Insufficient Cash | Submit through mobile UI | Spanish actionable feedback | Corrected and observed | PASS |
| Recovery | autorepuesto unavailable | Gateway/users available | Stop service; load Inventory; restart/retry | Retry UX and recovery | Observed | PASS |
| Recovery | users unavailable | Stored valid token | Stop users; deep link; restart/retry | Preserve token/URL; retry | Observed | PASS |
| Recovery | Gateway unavailable | Stored valid token | Stop Gateway; deep link; restart/retry | Preserve token/URL; retry | Observed | PASS |
| Navigation | Refresh/back/forward | Filtered Cash ledger | Reload, page2, Back, Forward | URL and data state preserved | Observed | PASS |
| Responsive | Operational routes | 390 x 844 | Visit Sale/Purchase/Inventory/AR/Users/Search/Cash | No document-level overflow | `scrollWidth=innerWidth` | PASS |
| Accessibility | Forms/dialogs/tables | Desktop + mobile | Keyboard focus and axe audit | Named controls/landmarks; zero violations | Corrected; 0 violations/incomplete | PASS |
| Performance | Dashboard sample | Local services warm | Capture browser vitals | No obvious blocking regression | TTFB2.4/FCP248/LCP308/CLS.0121 | PASS |
| Network | Browser boundary | Authenticated flows | Inspect browser request log | Gateway-only business traffic | Only `:4000/api` | PASS |
| Security | Credentials/responses | User create/login/me | Inspect payload persistence and response | No password/hash exposure | None exposed | PASS |
| Migrations | Historical schema | Existing database | Generate/deploy/status/count | 13, zero pending, unchanged | Verified | PASS |

## Matrix status

Scenarios listed: **79**

Passed: **79**

Failed: **0**

Blocked: **0**
