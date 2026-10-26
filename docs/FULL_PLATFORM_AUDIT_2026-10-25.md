# AnderTrack app and website audit — October 25, 2026

## Release assessment

**Staging pilot passes the tested database workflows; production acceptance remains incomplete.** This is a functional/security engineering audit, not an independent penetration test, cryptographic certification, concurrency load test or assurance that the platform cannot be hacked. No production settings, data or deployments were changed. No retained signup accounts, assignments, GPS positions, messages or delivery photos were created by this audit.

Story: a confirmed customer registers an individual/company profile, creates a service-specific request, dispatch reviews mileage and the quote, the customer approves, a qualified queued driver accepts, participants exchange messages, GPS is exposed only during the authorized trip, and the driver completes delivery with private photo evidence.

## Evidence and test boundaries

- Website: 162 automated tests pass, including four new security regression cases; production build passes.
- Driver: 30 automated tests pass; production build passes.
- `npm audit --json`: zero reported vulnerabilities in both lockfiles at the time checked. This does not prove the dependency chain is vulnerability-free.
- Five existing staging SQL suites pass: website signup/account isolation, service-specific requests/rates, customer hub lifecycle, connected dispatch/GPS/messaging security, and Phase 10 safety interlocks (11 checks).
- New `tests/sql/all_services_simultaneous_lifecycle.sql` passes against the real staging database using authenticated SQL roles and synthetic fixtures. It creates six independent customers and drivers inside one rollback-only transaction. These are SQL fixture rows, not successful GoTrue registrations or signed-in browser sessions.
- All six requests are submitted, reviewed, quote-approved, offered in queue order, accepted and progressed to `in_transit`. Dispatch can read six active GPS rows at once. Each driver sees one GPS row and each customer sees only its own request/location. Customer ↔ driver and driver ↔ dispatch messages are inserted/read for each service. All six deliveries are confirmed and customer GPS ends.
- GPS coordinates are synthetic. Calls execute sequentially with six active shipments at the same time; this is **not a six-device test, simultaneous rendered browser maps, or a multi-connection race test**.
- POD tests insert synthetic private Storage metadata only. Actual photo bytes, camera permission, upload/download and recipient acceptance remain live browser/device acceptance work.
- Post-test verification: 2 Auth users, 0 customer requests, 0 assignments, 0 live GPS rows. All 24 public tables have RLS enabled. Delivery evidence bucket is private, limited to 10 MB JPEG/PNG/WebP.
- Anonymous users cannot execute any public SECURITY DEFINER function. No authenticated UPDATE/DELETE table-wide grant was found on shipment messages, customer requests, delivery proofs or assignment/package/safety event tables. No public views were present.
- Browser observations of signup: individual/company UI available; Apple/Google buttons disabled with setup explanation. Email confirmation/account creation requires a human flow; no email signup or authenticated multi-role browser session was completed in this audit.

## Six-category outcome

| Service | Service-specific fields | Request → reviewed quote → driver acceptance | Customer/driver/dispatch messages | Simultaneous GPS scope | Delivery/cutoff |
|---|---|---|---|---|---|
| 3PL freight | Equipment, pallets, total weight | Pass — SQL simulation | Pass — SQL simulation | Pass — scoped synthetic feed | Pass — metadata fixture |
| OTR trucking | Equipment, pallets, total weight | Pass — SQL simulation | Pass — SQL simulation | Pass — scoped synthetic feed | Pass — metadata fixture |
| Courier | Package count/type, total package weight | Pass — SQL simulation | Pass — SQL simulation | Pass — scoped synthetic feed | Pass — metadata fixture |
| Food delivery | Restaurant, order, meals, handling; no payload/pallets | Pass — SQL simulation | Pass — SQL simulation | Pass — scoped synthetic feed | Pass — metadata fixture |
| Rideshare | Passengers, luggage, accessibility; no payload/pallets | Pass — SQL simulation | Pass — SQL simulation | Pass — scoped synthetic feed | Pass — metadata fixture |
| Trash removal | Waste category, items, volume; no payload/pallets | Pass — SQL simulation | Pass — SQL simulation | Pass — scoped synthetic feed | Pass — metadata fixture |

The shared delivery-photo workflow currently applies to every service. Passenger service should use an appropriate trip completion confirmation and avoid mandatory passenger photos; this needs a service-specific product/privacy decision before operating rideshare. Waste volume, passenger seat capacity and specialist equipment/body type are captured but not fully matched automatically.

## Features and phases

| Area | Verified coverage | Feedback / improvement |
|---|---|---|
| Phase 1: unified UI/navigation | Automated navigation/demo separation and build checks | Audit tablet/mobile and assistive technology with real tenant data. Several division panels remain planned, not operating products. |
| Phase 2: tenant/auth data | RLS on every public table; individual/company ownership and isolation SQL tests | Complete confirmed email/SMTP/redirect tests for customer, dispatcher and driver. Enable provider credentials for Apple/Google if required. |
| Phase 3: assignment state machine | Offer/accept/progress permissions; rejected stage skips and unauthorized actions | Real multi-browser status refresh and interrupted-session tests. |
| Phase 4: package custody/POD | Automated custody/photo guards; SQL delivery evidence gates and private access | Real barcode scans, photo upload/download, corrupt/spoofed images, EXIF privacy stripping and orphan-file retention jobs. |
| Phase 5: FIFO dispatch | Shared queue, oldest request matching, offer consumption, role checks | Explicit handling of stale/ineligible queue heads; parallel claims and offer/decline races using multiple DB connections. |
| Phase 6: shipment timeline | Event/timeline and export tests; actual lifecycle events in SQL | Real browser event ordering and operational retention/recovery procedures. |
| Phase 7: fleet intelligence/maintenance | Automated fleet logic plus DVIR/service authorization review | Four intentional public SECURITY DEFINER warnings remain; move implementations into private schema with invoker wrappers after compatibility testing. Validate real telemetry/history. |
| Phase 8: dispatch decision support | Automated preliminary match/ranking/reason tests | Commercial road routing, restrictions, real traffic/weather ETA and optimization are not integrated. Current pricing is an explicit sample policy, not AI fairness validation. |
| Phase 9: driver cockpit | Automated cockpit/duty display and mode checks | HOS/ELD, IFTA, biometric data, earnings/cash-out displays are illustrative/noncertified; do not operate as compliance/payroll instruments. |
| Phase 10: fleet safety | 11 staging interlock cases including OOS offer/accept/progress blocks and cross-tenant denial | True two-connection race with a new severe defect and dispatch activity remains unverified. |
| Customer hub | All six service requests, quote review/approval, booking idempotency, price tamper/stale quote defenses | Add policy administration UX/rate version review, cancellation after booking, refunds/disputes, customer notifications, multi-stop handling. |
| Live maps | Six active backend positions, per-driver/customer scopes; consent and completion cutoff | Live foreground browser/device test still required. Background native GPS, road routes and simultaneous customer/dispatch/driver rendered views not established. |
| Instant messenger | Real SQL inserts and reciprocal authorized reads; spoof/cross-thread/cross-tenant denial | Frontends poll every ~5 seconds; no instant delivery SLA, delivered/read acknowledgements or push notifications. Add server-enforced message rate limits and retention. |
| Driver six tabs | Existing automated universal driver tests and shared live backend coverage | Device GPS/network/camera tests, refresh failures, accessibility, and payments/earnings acceptance remain. |
| Assistant | Input/output allowlists, explicit review, stale-edit protection, auth/error/rate tests | Live authenticated cloud inference not verified; add distributed throttles/Gateway budget before public use. |
| Theme | Previous browser light/dark and persistence checks | Keep readable dark teal text on white with bright teal/orange accents. |

## Security fixes implemented

1. **Map tooltip injection:** Leaflet interprets tooltip strings as HTML. A previously safe popup's `textContent` was being passed back as a string to `bindTooltip`, reopening an HTML sink. Tooltip content now uses a DOM element populated via `textContent`. A hostile image/SVG-label regression confirms literal-text handling.
2. **Browser security headers on website and driver:** enforced CSP (`script-src 'self'`, no inline/eval scripts, no plugins, no framing, no base URL changes, same-origin form submissions, restricted network/image sources); `nosniff`, `DENY`, origin-only referrers (`strict-origin`), HSTS and permissions limiting GPS/camera to the same origin. Microphone/payment/USB are disabled. Inline **styles** remain allowed for React/Leaflet positioning; inline **scripts** do not.
3. **Sensitive route caching:** non-asset responses are marked `private, no-store`. The existing service worker caches only public shell/assets; it skips Supabase responses and query-string auth redirects.
4. **Client configuration fails closed:** both public Supabase clients require HTTPS, reject credential-bearing URLs/placeholders, and reject secret/service-role keys. Supports publishable keys and legacy anon JWTs. This guard does **not** remove a secret already bundled by a bad environment configuration; server secrets must never be placed in `VITE_*` variables.
5. **Existing protection verified:** RLS, authenticated private POD reads, server-controlled quote/state changes, customer tracking consent/session scope, stale/offline GPS gates and tenant/message isolation remain in effect.

CSP is scoped to the current staging Supabase project and OpenStreetMap tiles. Review and update the allowlist before connecting a new backend/provider. The Vercel preview toolbar may be blocked by the strict script policy. Do not weaken application CSP merely to load optional tooling.

## Encryption and privacy

Supabase documents AES-256 encryption at rest and TLS in transit ([provider security](https://supabase.com/security)); its public Auth/Storage/Data APIs enforce SSL ([TLS](https://supabase.com/docs/guides/security/tls), [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement)). The app uses HTTPS endpoints. This audit did not provision new encryption keys, enable customer-managed keys, inspect infrastructure disks/backups, or implement end-to-end encrypted messages. A browser-held encryption key would not protect data from a compromised browser or authorized account.

Data confidentiality also depends on access controls, session security and retention. The provider/service operator can access plaintext under its privileges; current authenticated browser sessions use local storage, so XSS prevention remains critical. Consider an audited server-session/BFF design with HttpOnly cookies, CSRF protection and server-side authorization before broad production use. Do not add a homemade cipher/key in the frontend.

OpenStreetMap requests disclose the viewed map area and client network information to the tile provider. External navigation sends selected addresses to Google Maps when users open it. Document these providers/flows and evaluate contracted tile/routing services and required privacy terms before production.

## Priority work before production

**P0 — Release gates**

- Complete human-confirmed customer signup/sign-in, company provisioning, invited dispatcher/driver sign-in and logout/revocation across the actual website/app origins. Verify delivery to an external email account and exact allowed redirect URLs. Apple/Google remain disabled.
- Run real simultaneous browsers/devices with six routes, foreground/background transitions, stale GPS, denied permission, bad network, customer consent withdrawal and completion cutoff. Do not call SQL simulation a live map/device acceptance test.
- Upload actual private photo bytes, retrieve only as permitted, reject corrupted/spoofed files server-side and remove EXIF metadata where appropriate. Establish retention/deletion and orphan upload cleanup. Verify package custody scans for actual courier manifests.
- Resolve service-specific completion semantics and passenger/waste/equipment capacity checks before commercial use.
- Require MFA for privileged operators with tested recovery, establish distributed request/message/AI rate limits, alerting, incident response, backup restore and secret rotation procedures.

**P1 — Security and reliability**

- Supabase advisor still reports leaked password protection disabled. Enable for any password-enabled paths (subject to plan/support); current website uses email links. No Auth setting was changed here.
- Four public DVIR/service SECURITY DEFINER functions have explicit authentication and organization-role gates, but advisor exposure warnings remain. Reviewed definitions and Phase 10 tests pass; refactor without breaking RPC signatures in a dedicated migration.
- Multi-connection FIFO/offer/severe-defect races, sustained load tests, cross-origin session UX and meaningful backend failure/abuse telemetry.
- Message acknowledgements/push/reconnect, server rate limiting, clear failed/retry states, signed-in cloud assistant inference with budget caps.

**P2 — Product depth**

- Commercial truck-safe routing, measured miles, traffic/weather ETA, route replay data, service-specific pricing policies, legal/operating requirements and qualifications.
- Real payment/payout/refund integrations; reconciliation and customer receipts. Current UI does not process money.
- Warehouse inventory/yard operations, restaurant menus/orders, passenger marketplace and certified HOS/ELD/IFTA integrations remain separate product work.

## References

- [Supabase security](https://supabase.com/security)
- [Supabase security advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Vercel response headers](https://vercel.com/docs/project-configuration/vercel-json#headers)
- [OWASP HTTP security headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)

## Deployed browser follow-up

Both staging previews at commit `0d847358c26fb4c0440369250f5711220210f0cf` reached READY. On those previews, all six customer requests were submitted through the actual browser **demo** UI with correct service fields; no database writes occurred. All six driver tabs rendered. A driver accepted, arrived, picked up and completed a sample OTR job; demo earnings reflected the completed sample job and a demo chat message rendered. This does not connect the demo customer and driver sessions or verify real authentication.

A rendered fleet map exposed an integration regression during verification: OSM served policy-block tiles. A blanket `no-referrer` header conflicts with OSM's required website identification. It was replaced with `strict-origin`, which sends only scheme/host/port and omits request paths/query strings. All four map implementations now use OSM's canonical `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, and CSP permits that exact tile origin. See [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/). No user-agent impersonation, proxy/bypass, cache-busting or access-protection change was used.

Unauthenticated HTTP verification of deployment URLs returned 302 to Vercel sign-in. The initial automatically-followed response belonged to Vercel's login page, not the app, and was rejected as application-header evidence. Security header configuration/build regression checks pass; exact authenticated wire-header inspection remains pending. Browser demonstrations load through the existing authorized browser session. Do not interpret the sign-in page's CSP as the application's policy.

Observed product issue: switching to OTR sets 250 sample miles while preserving a one-hour default pickup/delivery interval. Dispatch currently reviews time feasibility manually; add service-aware window defaults and travel-time validation before operating automatically. Also fix singular/plural summary text (for example “1 passengers”, “1 cubic yards”).

### Final map retest

Website and driver preview builds at `e9242cc8da262a42ca752d71f0c1ea131f8278df` are READY. The final website browser demo fleet map visually renders roads, towns and five sample fleet markers after the correction. DOM inspection shows 11 of 11 tile images complete, all from `tile.openstreetmap.org`, with `referrerPolicy` set to `strict-origin`; the screenshot confirms actual map imagery rather than provider error images. This resolves the observed tile-policy regression. The rendered positions are five illustrative demo points, separate from the six-service backend simulation; real six-device tracking remains pending.

Final checks after the correction: 162 website tests, 30 driver tests, both builds and `git diff --check` pass. No new database migrations or provider Auth settings were required.
