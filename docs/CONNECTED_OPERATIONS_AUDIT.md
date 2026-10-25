# Driver and website communications audit

Scope: Andertrack Staging (`ofyfausfhinwgrfmapgc`) and Vercel Preview only. No production release, domain changes, account creation or main merge. “Share three locations” was interpreted as “share their location”: foreground, consented driver GPS sharing with authorized dispatch.

## Driver tab audit

| Tab | Before | Current behavior | Verification / remaining boundary |
|---|---|---|---|
| Home | Service cards and test availability | Six services with approval indicators; explicit Share location & go online; live map and connection state | Online requires a fresh valid GPS fix. No real GPS is requested in demo. Physical-device permission and background behavior require device QA. |
| Jobs | Synthetic test-job table | Authorized operational offers, search, service filter, active/history views, pickup/trip progress, navigation link, dispatch contact | All six service offers were checked with simulated authenticated database roles. Existing POD remains required to finish; no automatic delivered status. |
| Queue | Missing | All same-organization waiting driver requests, FIFO positions, requested service, join/cancel and own-row highlight | Full queue visibility, FIFO handling and cross-organization denial passed rollback-only SQL QA. Raw queue rows stay protected; a narrow RPC returns the public queue fields. |
| Earnings | Sample amounts | Demo amounts explicitly labeled; operational completed-task count with settlement integration status | No invented live pay, tips or payout records. Payroll provider remains unconnected. |
| Messages | Placeholder | Private driver/dispatch thread, durable inserts, latest 100 messages, realtime subscription, polling fallback, retry-safe nonce and preserved draft | Both message directions and sender/tenant/thread isolation passed SQL role QA. Real two-browser delivery is a separate Auth/realtime test. |
| Account | Static service list | Signed-in identity, live license and service-review status, workspace choice, sharing status and stop control | Organization changes/sign-out clear prior data. Service selection never grants operating approval. |

## Website tab audit

| Workspace | Audit result |
|---|---|
| Universal Overview | Existing metrics preserved; connected snapshots supply current assignments and driver roster. |
| Live Tracking | Driver foreground GPS is merged into existing Leaflet map records. Offline consent-stopped rows clear coordinates; stale reporting is marked offline. Drivers receive only their own GPS through RLS. |
| Dispatch Center | Full queue, matching service filter, create-unassigned-task form, equipment-class filtering and existing protected claim/offer actions. |
| Messages & Task Intake | New private messenger, driver selection, task creation, service-access review, queue and location connection audit. |
| Dispatch Mode | Assigned-driver messenger is connected in the staging pilot; road ETA and trip timing remain explicitly unavailable. |
| Load Planning | Existing advisory planner preserved. Final offers still run through authenticated safety/qualification checks. |
| 3PL / OTR, Courier, Food, Passenger | Dispatch-created service task lists and intake are available. Customer booking, merchant menus, billing and marketplace features remain planned. |
| Waste & Collection | Added service workspace. Collection tasks can declare Class A, B or C equipment; the server rejects mismatched vehicle class. |
| Hotshot | Existing architecture preview retained; no unsupported external freight marketplace activation. |
| Warehouse / Delivery Overview | Existing shipment/equipment views preserved. No invented warehouse sensors or inventory integration. |
| Class C Fleet | Existing fleet and maintenance controls preserved. Food and passenger service remain inside Class C Local Services. |
| Fleet / Fleet Health / Fleet Intelligence | Existing vehicle, maintenance, replay and safety interfaces preserved. No new real diagnostic, telemetry history or mechanic certification provider claimed. |
| Driver Cockpit & HOS | Existing controls preserved. This work does not certify ELD/HOS, biometric or payroll integrations. |
| Shipment Journeys | Existing audited shipment/package/POD events remain the source of lifecycle history. |
| Smart Operations / Analytics | Existing organization-scoped signals and recorded-activity charts remain intact. |
| Settings | Existing appearance/session controls preserved. No automatic role or credential changes. |

## Database and protocol changes

- Three additive migrations: communications/tracking; collection equipment requirements; queue consistency. New tables: `at_dispatch_messages`, `at_live_driver_locations`, `at_driver_service_access`. Existing assignments and requests gain explicit service metadata; assignments also record required equipment class and creator.
- Both Vercel previews use the same Supabase project. `VITE_CONNECTED_OPERATIONS=true` is scoped to this feature branch's Preview environment. Public keys only; no service-role credentials in either client.
- Messages are append-only for clients, have server-authenticated senders and timestamps, and use a sender/nonce uniqueness constraint for retry safety. Latest 100 are shown; older records are retained in the database.
- GPS requires a server-issued tracking session token. Going offline invalidates that token and clears coordinates. Late callbacks cannot reactivate a stopped session. The client stops watching on hide, logout, workspace change and network loss. Browser background/locked-screen tracking is not supported. Server freshness checks expire eligibility after 60 seconds.
- Drivers can request only approved services. Dispatch records a qualification review; enabling a service requires an already verified license. Existing vehicle, license, active-load, safety and POD checks remain in effect.
- A matched queue request is consumed in the same transaction as the offer, including direct service offers. Failed offers retain FIFO order. Equipment requirements support A/B freight and A/B/C waste tasks; local courier/food/passenger task equipment is Class C.

## Verification evidence

- Root regression suite and driver unit suite; both Vite builds.
- `apps/driver/tests/connected-operations.test.mjs`: service identities, valid/fresh GPS, accuracy and bounds rejection, map consent filtering, POD-safe progress.
- `tests/sql/connected_driver_dispatch_security.sql`: both message directions; driver GPS readable by website role; online-location gate; full queue visibility; no skipping an ineligible head; offers for all six services; Class B collection equipment check; no sender forgery, self-approval, driver task creation, message edits, cross-thread/tenant access, anonymous access or late GPS reactivation. Fixtures use existing Auth users and roll back in full.
- Security advisor has no new findings for the new tables or helpers. Existing public DVIR/service RPC advisories and disabled leaked-password protection remain outside this change.
- Real browser sessions and a device GPS permission test are required before claiming end-to-end realtime acceptance. No successful SQL role simulation is reported as a real Auth sign-in.

## Release gate

Keep this branch unmerged. Publish only protected Vercel previews. Production readiness still requires real driver and dispatcher Auth sessions, two-device message delivery, real-device GPS/freshness/offline tests, and review of existing security advisories.
