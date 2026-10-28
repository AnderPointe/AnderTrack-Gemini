# AnderTrack technology and field UX audit

Reviewed October 27, 2026 (America/Chicago). Baseline: `27d6de6bc04e9ef010edaf99f6f561144ba1a1ee`, after the warehouse feature PR merged. Scope: repository, current staging project configuration, read-only database/advisor checks, dependency audit and clean local builds. No production changes or database mutations.

## Decision

**Keep React/Vite + Supabase/Postgres + Vercel.** This is a suitable architecture for the current staging platform. There is no evidence that a framework rewrite or microservices migration would improve current delivery. However, suitable technologies do not establish production capacity or a complete logistics product. Native background location, sustained workload, integrations, recovery and field acceptance remain open.

### Actual layers

| Layer | Verified implementation | Business assessment | Gaps / constraints |
|---|---|---|---|
| Website and staff UI | React/React DOM 19.3.1, Vite 6.4.5, plain CSS, Lucide icons. Root lazy-loads public site, customer hub, live workspace, demo and tracking lab. | Appropriate for an interactive browser dashboard; desktop and small-screen CSS exists. | OpsCommandCenter remains a large module; broad JSX and duplicated website/driver components increase maintenance work. No static typecheck or lint gate. Responsive CSS is not proof of field usability. |
| Driver application | Separate React/Vite browser app under `apps/driver`, shared connected operation logic, GPS through browser geolocation. | Mobile web is useful for pilots and foreground tasks. | It is not a native iOS/Android app. No service-worker/offline synchronization implementation found. Background/locked-screen GPS, push, store distribution and device behavior require a deliberate native mobile strategy if those are release requirements. |
| Backend / business rules | Supabase Data API and validated Postgres RPCs enforce organizations, roles, quotes, queue/assignment transitions, GPS consent and stock movements. Website Vercel function handles optional cloud AI. | A managed backend is a real backend; an additional general API server is not required merely to have business logic. Transactional invariants belong on the server. | More traffic requires measured capacity, query tuning and controlled refreshes. No general durable integration queue/outbox is implemented. AI limiter is per-process memory, not a distributed quota. |
| Database / identity / files | Staging PostgreSQL 17.11, Supabase Auth, private proof-of-delivery storage and RLS. All 28 public tables have RLS enabled. Supabase JS 2.118.0 pinned in both apps. | Appropriate relational foundation for orders, inventory and audit trails; shared database APIs connect website and driver app. | RLS enabled does not establish every policy is correct. Backups/PITR entitlement, restore drills, plan capacity, retention and disaster recovery are not verified here. |
| Maps and telemetry | Leaflet 1.9.4 with OpenStreetMap raster tiles, browser location updates, scoped database records, Realtime subscriptions plus polling. Three.js 0.180.0 supplies vehicle visualizations. | Suitable pilot maps and vehicle visuals. Shared location records support website/driver communication. | Three.js vehicle models are not a geographic 3D navigation engine. No contracted commercial truck-routing, traffic, ETA or telematics provider verified. Public OSM tiles are not a contracted service or an offline download source. |
| Hosting / delivery | Separate website and driver Vercel staging projects, Node 24.x; both latest deployments READY at inspection. GitHub test/build workflow. | Appropriate static hosting plus limited server functions. Separating frontend deployments does not require separate customer data stores. | Deployment readiness does not certify application flows. Required branch protection/check enforcement was not verified; do not assume CI can block a merge. |

Versions above come from committed lockfiles, not loose manifest ranges. Vite 6.4 is currently a security-maintained line; plan a tested major upgrade before support ends rather than changing majors during this audit. Node 24 is an LTS line and matches both existing Vercel projects.

## Changes made during this audit

1. CI now uses Node 24 to match Vercel and `engines.node = 24.x` is recorded in both package manifests/lockfile roots.
2. Both applications install with `npm ci` in CI, preserving the reviewed lockfile dependency tree. npm cache keys include both lockfiles.
3. Both dependency audits run in CI and fail on high/critical advisories. Lower-severity advisories remain review work; zero advisories today is not a guarantee against undisclosed vulnerabilities.
4. Driver and warehouse touch controls now have a 48px minimum height on coarse-pointer/small-screen layouts. Driver icon controls have 48px dimensions, driver focus outlines are explicit, and map gesture behavior is retained. This is a scoped CSS improvement, not an accessibility certification.

## The three growth questions

### Will it stay fast at twice the workload?

**Not yet proven.** No realistic signed-in multi-user capacity run has established a baseline. Existing tests exercise logic and simulated lifecycle behavior, not sustained concurrent end-user traffic.

The shared operations hook issues five parallel backend requests per snapshot every five seconds while the document is visible. Ignoring Realtime-triggered refreshes and other screens, that is approximately `5 × 60 / 5 = 60 requests per minute per visible connected session`. At 100 such sessions it is about 6,000 requests/minute; at 200 it is about 12,000. These are code-derived estimates, not measured plan limits or throughput results. Messaging and warehouse polling add traffic. Hidden tabs reduce timer polling but subscription/event-triggered work needs separate measurement.

The snapshot also fetches organization-wide location/profile/access lists; large row sets can hit Data API limits. Assignment lists cap at 200, messages at 100; warehouse catalog/balance reads page up to a pilot limit below 5,000 rows and history shows the latest 100. Those limits protect some requests but are not a full-history reporting solution.

Fresh staging advisors report:

| Finding | Count | Required follow-up |
|---|---:|---|
| Foreign keys without covering indexes | 5 | Review lookup/join/delete plans, then add covering indexes in a separate staging migration. |
| RLS auth expressions that may evaluate per row | 3 | Review policy semantics and use init-plan patterns where safe; re-run role/isolation tests. |
| Multiple permissive SELECT policies | 2 | Review cost and policy composition without removing legitimate customer/driver access. |
| Apparently unused indexes | 14 | Keep until representative production-like usage is measured; staging inactivity is insufficient reason to drop them. |
| Auth fixed maximum database connections | 1 | Review allocation with instance size before scaling. |

The five FK columns are `at_customer_requests.reviewed_by`, `at_vehicle_dvir_reports.assignment_id`, and `at_vehicle_safety_events.dvir_id`, `service_order_id`, `vehicle_id`.

Before claiming 2× readiness, use an isolated authorized acceptance tenant and test a measured baseline and double it. Include realistic shipment history, dispatch snapshots, queue acceptance races, GPS writes and customer/driver/dispatch messages. Run a sustained test, not a burst against empty tables. Capture p50/p95/p99 latency, error/429 rates, database CPU/memory/connections/locks, requests per active user, GPS freshness and bytes transferred. Suggested initial acceptance targets: p95 critical reads under 1s, writes under 2s, error rate below 1%, no tenant leakage or duplicate transitions, and no sustained resource saturation. These are proposed product targets, not measured results or provider guarantees. Include warm/cold startup and constrained mobile network conditions.

Priority engineering work: coalesce overlapping refreshes, minimize fetched columns/rows, subscribe to scoped changes with a slower reconnect fallback, paginate server-side, and aggregate reports on the server. Keep freshness/stale indicators truthful. Use pooled connections if future server code connects directly to Postgres; current browser clients use Supabase HTTP APIs rather than opening database sockets themselves.

### Is it easy to update and improve?

**Reasonable foundation, with maintenance debt.** There are committed SQL migrations, pure logic modules, regression tests, route-level lazy loading and separate frontend builds. Reproducible CI improves consistency. Shared operation logic already avoids some behavioral divergence.

Next priorities: extract shared request/service schemas and UI contracts into a documented common package; split OpsCommandCenter by workflow; add ESLint and gradual TypeScript checking to new business-critical modules; establish migration review and required checks; add sanitized structured logs/error monitoring with release identifiers. Keep exact business transitions in RPCs and test browser/API/database paths together. Do not turn every existing JSX file into TypeScript as an unrelated rewrite.

### Can it connect to our other software?

**Technically extensible, but most business integrations do not exist yet.** Postgres and authenticated APIs are appropriate connection points. Generic database access is not a finished accounting or ERP connector.

| Integration | Current evidence | What is still required |
|---|---|---|
| Website ↔ driver application | Shared staging Supabase project, scoped RPCs, messages, location records and Realtime/polling hooks | Real simultaneous signed-in browser/device acceptance and clear latency expectations. |
| GPS | Browser geolocation and fresh/stale gates | Native/background tracking if required; vendor-specific telematics adapters, device authentication and replay/duplicate protection. |
| Maps / route planning | Leaflet raster maps and external navigation handoff | Commercial routing/traffic/ETA contract, service-specific route constraints and failure handling. |
| Accounting / ERP | No completed accounting or ERP adapter found | Choose the actual vendor, map invoice/customer/order IDs and currencies, implement authorized backend sync and reconcile failures. |
| Barcode / warehouse hardware | Warehouse stock records and manual movements | Scanner capture workflows, barcode standards, item/location mappings and device acceptance. |
| Notifications | In-app status/messages | Provider configuration and verified push/SMS/email delivery, retries, consent and delivery receipts. |
| AI autofill | Local guided extraction and optional website `/api/request-assistant` with Auth check, bounded input, schema validation, user review and timeout | Confirm model/provider settings and distributed usage control. The separate driver project has no matching API function; its relative cloud endpoint cannot be assumed available and falls back to guided assistance. |

For each external connector, use a backend adapter with per-organization credentials kept out of the browser, minimal scopes, verified inbound webhook signatures, idempotency keys, an outbox/queue, bounded retries and reconciliation. ERP events must not mutate protected state without the same server business rules. These are implementation requirements, not capabilities already delivered.

## Field UI/UX assessment

| User | Implemented support | Next-action and field acceptance gap |
|---|---|---|
| Office / dispatch | Assignment/queue workflows, request review, messaging, service-specific fields and filtered reports | Reduce navigation density; make the next permissible assignment action primary; verify keyboard-only dispatch and error recovery with staff. |
| Warehouse | Stock cards, item/location search, receive/issue/transfer, reason entry and ledger; clearer touch targets added | A stock form is not a task-directed pick/pack UI. Add scan-first assigned tasks and defaults that reduce typing; validate on a handheld with physical counts. |
| Driver | Named progression actions (arrive, pickup, start trip), mobile layouts, maps, proof upload and visible tracking state; larger touch targets added | Test in daylight, with gloves, on small devices and weak networks. Do not imply offline booking/completion or locked-screen background GPS works. Confirm no critical control is obscured by fixed navigation/keyboard. |
| Manager | Visible-organization counts, activity charts, inventory alerts and report filters | Full-history KPIs and actual financial/on-time metrics require server aggregates and trusted events. Existing loaded-data estimates must remain labeled. |

All roles need a primary action, explicit success/failure and recoverable retry without duplicate work. Existing code supports parts of this; every tab has not been certified through human field testing. Preserve bright teal/orange with white/black modes, distinguish status with text/icons as well as color, and measure contrast for the actual component states.

## Security and reliability assessment

The architecture supports strong security but does not make the product hack-proof. Read-only staging inspection confirms RLS on all 28 public tables. Current security advisor findings remain four legacy signed-in-callable SECURITY DEFINER RPC warnings and disabled leaked-password protection; those were not changed by this audit. Review the role guards/private wrapper migration approach without abruptly removing operational access. Operator MFA, distributed abuse controls, session revocation behavior, restore exercises and independent security testing remain release work.

Never put service-role secrets in `VITE_*` variables. Validate identity/tenant/role on server operations; a hidden button is not authorization. Existing fixed staging-host guards are deliberate pilot boundaries and need an explicit production release plan, not removal during audit. HTTPS headers do not establish at-rest key control or end-to-end encrypted messaging.

## Verification and limits

- Clean `npm ci` succeeds for both applications on local Node 24.22.1.
- Website: 171 tests pass. Driver: 30 tests pass. Both production builds pass after this change.
- `npm audit --json`: zero known advisories in both lockfile trees at inspection.
- Main build JavaScript: bootstrap about 230kB raw / 72kB gzip; OpsCommandCenter about 410kB / 112kB; Three.js about 496kB / 125kB. Driver bootstrap about 229kB / 72kB; UniversalDriver about 229kB / 69kB; Supabase shared chunk about 233kB / 61kB. These are individual emitted chunks, not route transfer totals, render timings or mobile performance scores. Heavy features remain candidates for more conditional loading.
- Vercel website and driver projects both report Vite, Node 24.x and a READY preview at inspection. This is deployment configuration evidence, not authenticated end-to-end acceptance of this audit patch.
- Read-only staging query confirms PostgreSQL 17.11 and 28/28 public tables with RLS; security/performance advisors were refreshed.
- No new load test, offline test, background GPS test, physical scanner test, restore exercise or signed-in field UX certification was performed. No production deployment, environment change, schema change, or merge was performed by this audit.

## Primary references checked

- React lazy-loading: https://react.dev/reference/react/lazy
- Vite supported release lines: https://vite.dev/releases
- Node release support: https://nodejs.org/en/about/previous-releases
- Supabase production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- Supabase connection management: https://supabase.com/docs/guides/database/connection-management
- OpenStreetMap standard tile policy: https://operations.osmfoundation.org/policies/tiles/

The verdict is to retain the stack and close the measured implementation gaps before making scale, offline or integration promises.
