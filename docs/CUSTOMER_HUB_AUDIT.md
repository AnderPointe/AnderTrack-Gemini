# Customer service hub — staging pilot

## User flow

`/hub` requires a signed-in customer. `/hub?demo=1` is a local, fictional interactive preview. Warehouse users can enter service/provider, addresses, four pallets (or another count), total payload, mileage estimate, pickup/deadline and urgency. Dispatch reviews a road route and verifies mileage before issuing a quote. The customer must approve the reviewed amount before a normal unassigned task is created. Dispatch then offers it through the existing qualified-driver/FIFO workflow; the assigned driver accepts in the driver app.

Company administrators opt into customer intake and publish their rate policy in Messages & Task Intake → Customer service hub. No live company is listed automatically. Provider names and published rates are visible to signed-in customers; fleet records remain private. Company admins control base charge, per-mile, per-pallet, per-started-1,000-lb charge, minimum price, driver share, driver floor and maximum payload.

## Pricing and intelligence

Server-side integer-cent USD pricing is authoritative. A quote records its policy version, mileage, cost breakdown, driver compensation and included service fee. Priority adds 25% and express 50% to the pre-minimum subtotal. A minimum-fare adjustment is explicit. Driver compensation is the higher of the policy floor or configured share; the floor cannot exceed the customer minimum. A later policy change does not alter an approved shipment quote.

Illustrative defaults: four pallets, 4,200 lb, 65 miles and priority urgency produce $275 total, including $220 driver compensation and $55 service fee. These are sample rates, not a claim of market fairness or a commercial price recommendation. Dispatch must review handling/equipment, accessorials, taxes and tolls; payment collection and payouts are not connected.

Rules provide an explainable starting point. AI pricing, automatic traffic ETA, address geocoding, route optimization, truck restrictions and road-distance APIs are not connected. Dispatch can open the requested route in external navigation and verify mileage manually. Route selection must consider vehicle limits and the deadline; estimated mileage is never represented as a measured route.

## Tracking, conversations and proof

Customer status is a narrow, authenticated shipment RPC, never access to the fleet-location table. It returns GPS only for the request owner's or assigned participant's exact shipment while in_transit, while sharing/online, with a fix less than 60 seconds old, and only with customer-tracking consent attached to that active driver session. Older dispatch-only sessions are excluded. Customer UI removes stale coordinates locally when the entitlement expires and polls visible shipments every five seconds. It hides the map immediately on the next confirmed delivery/cancellation response (normally within five seconds); earlier authorized observations cannot be retracted.

GPS is foreground browser tracking. Hiding the driver app, navigating to another app, going offline, logging out or switching workspaces stops sharing. Continuous background/locked-phone tracking requires a native location implementation and device acceptance work. The customer map is an actual authorized location only; demo mode never supplies fictional GPS to a live map. External navigation may hide the browser and stop foreground sharing.

Shipment messages are durable, append-only, private to the customer, current assigned driver and authorized company dispatch. The latest 100 are polled every five seconds while visible. Sender/timestamps are server-authenticated; nonce uniqueness makes send retries safe. No push/SMS/email notification delivery is claimed.

The universal driver job detail now embeds the existing private photo/POD workflow and receives the same Supabase client as the app. Only the verified assigned driver can complete an in-transit load. The server requires an existing private photo object, recipient name and complete Class C manifest scans. Customer load terms show payload, window, urgency and agreed compensation. A verified vehicle capacity is required before a customer task can be offered/progressed; unknown or insufficient capacity fails closed.

After delivered, GPS entitlement ends even if that driver is still sharing for dispatch or another trip. Customers retain status history and can download their exact confirmed proof through authenticated private Storage access. There are no public tracking links, public evidence buckets or customer access to unconfirmed uploads. Temporary unauthenticated guest tracking is not implemented.

## Verification and release limits

- 141 website tests + 30 driver tests pass. Both builds pass.
- New price tests check each fee, rounding, minimum, compensation floor and invalid/excessive cargo. Tracking tests cover shipment state, freshness, bounds and entitlement expiry.
- `tests/sql/customer_hub_lifecycle.sql` passed against staging with simulated roles: request/retry, server quote, dispatch-only review, stale-price rejection, approval/idempotent task creation, vehicle payload rejection/acceptance, FIFO offer/driver acceptance/progress, customer-driver messages, consent-gated transit GPS, blocked delivery without evidence, delivery cutoff, own-proof access, unrelated-user denial and anonymous denial.
- SQL fixtures reuse two existing Auth users, temporarily alter memberships/qualifications and insert a synthetic Storage metadata object within one rolled-back transaction. No actual image bytes, new Auth identities or retained business records are created. This verifies server authorization and lifecycle logic, not real sign-in, Storage upload/download bytes, browser realtime or physical GPS.
- Fresh security advisors report no new issue on these tables/helpers; existing DVIR RPC and leaked-password warnings predate this change.
- Both migrations apply only to Andertrack Staging. No production migration, merge or deployment is performed by this work.

Before public launch: configure external-email/OAuth signup, enable an intentionally reviewed company policy, validate real customer/dispatch/driver sessions, test a physical GPS trip and image upload/download, and configure actual routing plus payment/payout providers. Existing staging driver qualification must be completed legitimately before live offers; rollback-only SQL qualification fixtures do not verify a real driver.

## Service-specific request correction

The request service now controls its labels, required fields, stored details and quote charges:

| Service | Service details | Weight / pallets |
|---|---|---|
| 3PL Freight / OTR | Requested equipment, freight/load description, pickup/delivery appointments | Required load weight; pallet count |
| Courier | Package count/type and handling instructions | Required total package weight; no pallets |
| Food | Restaurant, order reference, meal/item count, hot/cold handling and handoff instructions | No weight or pallets |
| Rideshare | Passengers, luggage, optional vehicle accessibility needs and pickup instructions | No weight or pallets |
| Trash Removal | Waste category, item count, volume and collection instructions | No weight or pallets |

Switching service resets service-specific fields and address/description prompts. Only that service's whitelisted details are saved. Freight/OTR retain pallet and weight charges; courier has weight charges only. Food, rideshare and trash quotes have no pallet/weight charges. Their item, passenger and volume details support dispatch review; per-meal, per-passenger and per-volume surcharges are not introduced. Other published base/distance/minimum/urgency rules still apply. Existing approved quote snapshots are not rewritten.

Staging migration makes weight/pallet columns nullable and validates service details in the protected submission RPC. New food submissions do not need dummy weight values; malicious/stale freight values are discarded. Dispatch and driver request summaries use the actual service details. Weight-capacity checks still apply to weighted cargo; other requirements (food handling, seats/accessibility, permitted disposal/volume) require the existing service qualification and dispatch review, without claiming a new automated equipment-capacity match for those fields.

Verification: 148 website tests + 30 driver tests pass; both builds pass. `tests/sql/service_specific_requests.sql` passed for all six service types, including food without payload, ignored stale freight values, invalid counts, missing courier weight and server quote review/approval. The full rollback-only customer lifecycle regression also passes. No retained business records or new Auth accounts are created by these tests.
