# Driver cockpit redesign and functionality audit

October 27, 2026 (America/Chicago). Staging-only change to AnderTrack-Gemini. Reference: user-supplied Driver App UI.webp. The visual hierarchy follows the supplied vehicle header, orange illumination, compact telemetry cards, map, tab strip and activity list. Original code-native truck artwork is an illustration, not a photo of an assigned unit. AnderTrack branding and teal/orange/white/black light/dark modes are retained.

## Delivered changes

- Driver root now opens Universal Driver; `/universal` remains supported. The previous driver application remains available at `/legacy`, with explicit links from account, readiness and maintenance views. Its training, sign-in and historical driver controls are retained.
- Home includes a new vehicle command center: Overview, Location, Health, Maintenance and History. Driver Jobs, Queue, Earnings, Messages and Account remain separate existing workflows below/in main navigation.
- Overview shows counts of loaded assignments and opens the selected service's active assignment. Location uses the existing foreground GPS map when a fresh shared fix exists; demo shows an explicitly illustrative route. No fake driver location is published or requested in demo.
- Real speed/heading are shown only when valid and fresh; otherwise em dashes with an explanation. The location hook now retains the already-validated speed/heading from its successful GPS publication for presentation.
- History shows loaded assignment states and any available creation/update timestamp; it does not invent ignition/fuel events. Visible-history CSV export neutralizes spreadsheet formulas and excludes GPS/user-account columns.
- Health distinguishes license verification, GPS freshness and unavailable diagnostic feeds. Maintenance explicitly shows its missing driver-side service feed rather than fake due/completed counts. Both provide links to retained controls.
- Tabs support keyboard arrows/Home/End, selected state and associated panel. Interactive controls retain touch sizing; no new map library or image requests were added.

## What works versus what does not

“Implemented” below is code/regression evidence, not proof of a real signed-in device test. Browser demo acceptance is recorded separately after deployment.

| Feature | Assessment | Evidence / limitation |
|---|---|---|
| Professional cockpit layout | Implemented | Original vehicle artwork, responsive panel layout, tabs, labeled map, amber actions and light/dark token support. |
| Six service choices | Preserved | 3PL, OTR, courier, food, rideshare and waste retain service IDs and existing job filters/queue requests. |
| Driver sign-in / organization switching | Preserved; real sign-in not retested | Existing password/magic-link and organization-session cleanup paths retained. Needs actual approved accounts, redirects and provider/email validation. |
| Job acceptance / progression | Preserved | Existing RPCs and state machine untouched; demo progression remains local. Real qualification and fresh-GPS gates remain server enforced. |
| Shared queue | Preserved | Existing service approvals, fresh-location qualification and FIFO component remain. No new permissions or qualification bypass. |
| Dispatcher messaging | Preserved | Existing Messenger component remains mounted/scoped with its active-tab behavior. Demo messages are local; no external message is sent by UI QA. |
| Customer/driver shipment messages | Preserved | Existing CustomerLoad remains inside assigned job detail. Simultaneous real participant acceptance remains a separate gate. |
| Proof of delivery | Preserved | DeliveryWorkflow remains in job detail with existing assignment/user/role props; server delivery cannot be replaced by demo completion. Real image bytes/private storage not retested. |
| Foreground shared GPS | Preserved / presentation expanded | Existing map, consent, fresh/stale checks and stop-on-hide behavior. Actual device permissions/background transitions not executed in this visual change. |
| Background GPS / offline completion | Not supported as a guarantee | Current sharing stops on hide/offline. PWA shell installation/caching exists; it does not mean queued business writes or background tracking work. |
| Traffic-aware ETA / disruptions | Not connected | No contracted routing/traffic provider. View explicitly states ETA unavailable. Demo route is illustrative. |
| Vehicle diagnostics / fuel / odometer | Not connected | No ECU/telematics source; no synthetic health scores or fuel figures shown as real. |
| Vehicle identity / photo | Partial | Live uses assigned vehicle UUID fragment when available. No unit/make/model lookup or verified vehicle photo is wired here. Illustration is labeled. |
| Maintenance schedule / DVIR in new cockpit | Partial / feed missing | Dispatcher maintenance backend exists. New driver tab does not query or modify service records; authorized assigned-unit maintenance and defect reporting need integration. |
| History / export | Implemented with loaded-data limit | State snapshot CSV, not full event telemetry or complete work history. Current connected assignment cap is 200. |
| Earnings / payouts | Unconnected | Existing estimates are demo-only. Live earnings view retains its honest payroll/settlement disclaimer. |
| AI assistant | Existing guided assistance preserved | No new model/provider is introduced. Separate driver cloud endpoint remains unavailable unless deployed/configured independently. |
| Security and isolation | Boundaries preserved | No database schema/grant/key changes. Client presentation does not replace Auth, RLS, assignment qualification or privacy checks. |

## Fix plan

| Priority | Work | Acceptance requirement |
|---|---|---|
| P0 before operational launch | Run real approved driver/dispatcher/customer sessions on separate devices | All six service requests, queue race/accept, two-way messages, GPS freshness/cutoff and private photo completion; verify tenant isolation. Do not verify a test driver's license merely to bypass a gate. |
| P0 before operational launch | Confirm session, Auth redirects, error handling, support/backup and recovery | Real sign-in/out and revoked session behavior; no previous organization's data remains after switching. Tested alert receipt and restore/rollback evidence. |
| P1 cockpit completion | Fetch authorized assigned vehicle identity and service/DVIR records | Tenant/driver-scoped access, truthful empty/error states, real due/completed statuses and defect RPCs with role-denial tests. No new broad client grants. |
| P1 field readiness | Physical phone/poor network/daylight/glove checks | Readable text, no clipped controls, permission denial/retry, no duplicate writes, location stops as described. Decide native background strategy before promising continuous tracking. |
| P1 operations | Choose route/traffic/ETA provider | Actual road distance, truck/service constraints, provider error fallback and freshness labels. Avoid displaying arrival estimates based only on straight-line/demo routes. |
| P2 data depth | Server-paginated history and earnings integration | Accurate complete event timelines and audited settlement amounts; loaded-state CSV remains clearly labeled until replaced. |
| P2 telemetry | Contract vehicle/telematics integrations | Device identity, signed ingestion, units/freshness, no impossible speed/heading, authorized vehicle access. |
| P2 accessibility/performance | Formal screen reader/contrast and low-end phone measurements | Verify both themes, tab semantics, touch target sizes, p95 interactions and map load without speculative benchmark claims. |

## Automated validation

Website regression suite: 178 tests. Driver regression suite: 33 tests, including active-assignment prioritization/service isolation, fresh versus invalid/stale telemetry, and safe CSV escaping/field exclusion. Both builds pass. No dependency or database changes are required. Browser acceptance and any discovered limitations are appended after preview testing.

## Scope

No production promotion, merge, real-driver qualification change, real location transmission or external dispatch message is performed by this UI change. The monitoring task continues to watch its previously approved immutable baseline; this feature preview is not silently substituted into monitoring.

## Browser acceptance evidence

Verified on Vercel preview code `35e3f3c854a327227e1ab6274d40f9cf0daf8f3e`, then rechecked navigation/theme/demo wording on refined code `932fe992723d739b16d404b4292c77b9137f2241`:

- Overview, Location, Health, Maintenance and History render; ArrowRight from Maintenance selects History; visible-history CSV download completes.
- All six service sample jobs appear under All services / All jobs. OTR sample TEST-2049 progresses offer → accepted → pickup → transit → completed. Earnings reflects its sample $310 and retains the no-payout disclosure.
- Demo availability permits joining the OTR queue; own request appears as position 2 with the correct service. Existing sample driver remains visible. No dispatch request is transmitted.
- Local demo message sends and appears as You with Demo only. This does not demonstrate two-way messaging between real devices.
- Account and legacy link remain reachable; `/legacy` renders the retained driver login/training entry. Real account login was not performed.
- Light/dark toggles render both palettes. Final main navigation stays fixed to the viewport bottom; all six nav buttons measured 48px tall in the desktop browser. Main tab changes return to top. Physical-phone viewport/keyboard/glove acceptance remains pending.
- No application console errors observed during these checks (browser-extension errors excluded).
- Local screenshots: `docs/qa/driver-cockpit-dark.jpg` and `docs/qa/driver-cockpit-light.jpg`. The sample map and truck are illustrations, not live GPS/traffic or an assigned vehicle photo.

Issues corrected during QA: navigation was below the long Home content, so it is now persistent; main view changes reset scroll; demo availability/privacy wording now explicitly says no device location is requested/shared. Remaining product/data gaps are listed in the fix plan above.
