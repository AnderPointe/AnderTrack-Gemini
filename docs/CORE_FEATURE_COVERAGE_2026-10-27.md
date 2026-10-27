# AnderTrack core-feature audit — October 27, 2026

## Assessment

All six requested areas now have an implemented operational foundation in the staging codebase. This is **not** a declaration that every area is production-complete. The largest missing area was real inventory: the existing Warehouse Operations screen represented equipment and shipment readiness, not SKUs, stock or replenishment. This change adds company-scoped inventory tables, audited stock movements and a connected UI to close that basic gap. Reporting also gains explicit filters and stock exports.

This audit uses the six requirements supplied by the user. A navigation label, illustrative chart, planned workspace or passing SQL simulation is not counted as successful live browser/device acceptance. No production merge/deployment or settings changes were performed.

## Requirement coverage

| Requested area | What exists now | Evidence | Remaining depth / release gaps |
|---|---|---|---|
| Order management | Six service-specific customer request forms; server estimates; dispatch quote review; customer approval; assignment state machine; FIFO offers; driver acceptance/pickup/transit; photo-backed delivery and audit events. Pre-booking request cancellation. | Customer hub/dispatch components, assignment/delivery RPCs; six-service geographic lifecycle staging regression passes. Previous browser demo submitted each service. | Post-booking changes/cancellation, returns/refunds, bulk order import, multi-stop orders and real external signup/POD acceptance. |
| Inventory & warehouse management | **Added:** SKU/name/unit/reorder-point catalog, coded warehouse/bay/rack/bin locations, per-location on-hand quantities, receive/issue/transfer, low-stock filter, stock CSV and movement ledger. Existing vehicle-readiness dashboard remains below it. | Four new staging tables with RLS; three protected RPCs with private implementations; `warehouse_inventory_security.sql` passes; new pure/API regression tests. | Supplier/purchase orders, inbound appointments, pick/pack/reservations, lot/serial/expiry, cycle-count adjustments, editing/archiving catalog settings, dock capacity and shipment-to-stock reconciliation. Low-stock flags do not automatically reorder. |
| Transport & fleet management | Driver/vehicle roster, qualification and equipment checks, service approval, queue assignment, offer/accept/progress, fleet health, DVIR/service orders, preliminary planning and external navigation handoff. | Existing fleet/assignment/safety modules; automated matching tests; geographic lifecycle and previous Phase 10 interlock tests. | Commercial truck-safe embedded routes, road distance/traffic ETA, fuel/telematics integrations, true multi-connection races, native background GPS and full seat/volume/body-type matching. |
| Real-time tracking & delivery updates | Foreground driver tracking, permission/session consent, fresh/stale gates, dispatch fleet map, customer-only in-transit location, delivery milestones, customer/driver/dispatch messages, completion tracking cutoff. Optimized stable marker updates and canvas rendering. | Geographic staging regression passes across TX/FL/WA/CA/IL/NY, including stale cutoff/recovery and tenant scopes. Prior browser beacon lab tests at 6/100/500/1000 points. | Actual concurrent physical devices/browsers, background transitions, poor network recovery, customer push/email/SMS and delivery/read acknowledgements. Frontends poll at approximately 5 seconds; this is not an instant update SLA. |
| Reporting & analytics | Existing shipment/activity/fleet/smart-operation panels; **added:** inclusive UTC creation-date, division and status filters, filtered shipment table/CSV, mileage completeness counts, stock/reorder CSV. | New reporting calculations tested for dates, status and absent mileage; CSV formula-injection defenses retained; browser acceptance below. | Full-history server-side pagination/aggregation, trusted actual mileage/cost, financial/settlement reports and on-time metrics based on confirmed event timestamps. Loaded records are explicitly disclosed; connected assignment snapshots currently cap at 200. |
| Security & access control | Supabase Auth, organization membership/role checks, RLS on every public table, private POD storage, private validated state-changing functions, restricted public wrappers, browser CSP/HTTPS/HSTS protections, literal-text map labels, public-key guards and protected exports. New inventory has no direct client write grants. | New inventory negative/permission/idempotency tests; existing isolation/security tests; current security advisor shows no new warnings from inventory. | Human-confirmed signup/provider flows, operator MFA/recovery, distributed abuse limits, backup restore/incident drills, token/session review and independent penetration testing. Four legacy public DVIR/service definer warnings plus leaked-password protection disabled remain. |

## Inventory semantics and safeguards

- Catalog items have a fixed SKU, unit and reorder point at creation. Codes are normalized uppercase and unique per company. A repeated identical create returns the existing ID; conflicting settings are rejected. Later catalog maintenance needs its own audited workflow.
- Stock is tracked per item and location. Different units are never summed into a misleading fleet-wide stock quantity; summary cards count SKUs, locations and low-stock SKUs.
- A low-stock alert occurs when total recorded on-hand stock across a SKU's locations is **at or below** its configured reorder point, including zero stock.
- Receipt increases source-location stock; issue decreases it. Transfer atomically decreases one location and increases another, conserving total stock. No negative balance is allowed. Quantities support three decimal places and bounded storage values.
- Every stock movement records actor, time, reason, before/after balances and a unique client nonce. A retry with the same actor and identical payload replays the existing result; changed payload with the same nonce fails.
- Inventory writes serialize on company/item advisory locks and lock affected balance rows. Single-transaction tests validate atomic results; a true two-connection contention test remains separate acceptance work.
- Only admins/dispatchers can read company inventory or execute inventory operations. Drivers, customers, anonymous users and other companies cannot access it. Direct client balance updates and ledger deletions are denied. Database owners/service operators remain privileged; this is an application audit trail, not WORM storage or a cryptographic signature ledger.
- UI refreshes visible inventory every ten seconds. It pages reads rather than silently relying on one default response page and refuses oversized pilot snapshots instead of showing partial totals. At 5,000 or more rows in any catalog/balance list, a dedicated paginated view is required. Latest 100 movement records are displayed.
- Stock movements are **not** automatically linked to load pickup/delivery. A planner records actual warehouse activity explicitly; booking a load does not reserve stock, and marking a delivery complete does not deduct it twice.
- Live writes remain connected-staging-only. Demo mode uses local synthetic state and never sends warehouse writes.

## Validation

- Website: 171 automated tests pass (five new inventory/report cases); driver: 30 tests pass. Both production builds pass.
- SQL staging `warehouse_inventory_security.sql`: receive/issue/transfer, total-stock conservation, repeat create and movement idempotency, mismatched replay refusal, excess issue/invalid precision/self-transfer rejection, immutable stock/ledger grants, cross-company transfer denial, driver/anonymous access denial. All fixtures rolled back.
- Existing six-service geographic lifecycle staging regression is rerun after the inventory migration to check request → quote → queue/offer → acceptance → messaging → stale/fresh GPS → delivery cutoff remains intact.
- Current staging schema has four additional inventory tables; all have RLS. Security advisor reports the same preexisting legacy-function/password warnings, with no new inventory exposure warning.
- Inventory test fixture uses temporary synthetic Auth rows and authenticated SQL roles; it does not create verified operational users, log into a browser, send emails or change real driver qualifications. Existing user accounts remain untouched.

## Files and release scope

- Migration: `supabase/migrations/20261027232120_warehouse_inventory_core.sql` applied only to Andertrack Staging (`ofyfausfhinwgrfmapgc`).
- `src/features/warehouse/WarehouseInventory.jsx`: new inventory UI above existing Warehouse Operations equipment view.
- `src/lib/inventory.js`, `src/lib/inventory-api.js`: stock calculation/demo validation/export and scoped reads.
- `src/features/live/OperationalReports.jsx`, `src/lib/operational-reports.js`: filtered operational report.
- `tests/sql/warehouse_inventory_security.sql`, `tests/inventory-reports.test.mjs`: reproducible validation.

## Production priorities

1. Verify real customer, driver and dispatcher sign-in, exact redirect URLs, provider settings, photo uploads/downloads and multi-device location updates. Keep license verification independent of testing.
2. Operate receipt/issue/transfer with actual warehouse staff in an isolated acceptance tenant; reconcile ledger against physical counts. Test multiple operators contending for the same SKU.
3. Decide required WMS depth (supplier POs, reserved stock, lots/serials, cycle counts and barcode pick/pack) before presenting this as a complete WMS.
4. Add contracted routing/ETA/notification providers, full-history server reporting and service-specific capacity/completion controls.
5. Complete MFA, abuse limits, security advisory follow-up, restore/incident drills and session hardening before public release.

The migration was created with the Supabase CLI, then its filename was aligned with the observed staging migration-history version `20261027232120` after MCP application. Existing migration-history differences outside this change were not repaired. Staging had four existing Auth users before/after these rollback tests; no existing memberships or qualifications were changed.
