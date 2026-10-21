# AnderTrack Phase 4 — Driver Training and Staging QA

## Goal
Make the driver UX testable even when staging authentication mail is constrained, **without bypassing** Supabase Auth, RLS, or qualification interlocks.

## Code scope
- `apps/driver/src/training.js`: deterministic, fictional fixtures and local-only status reducer.
- `apps/driver/src/TrainingMode.jsx`: explicit training banner, offer accept/decline practice, pickup progress practice, no maps, no credentials, no Supabase calls.
- `apps/driver/src/readiness.js` + `DriverReadiness.jsx`: account checks visible only after authenticated sign-in, entirely read-only.
- Unit tests cover no cross-tenant training mutations, allowed transitions, complete stop before delivery confirmation, and unverified/offline staging restrictions.
- No new RPCs, migrations, secrets, domain changes or production deployment.

## Staging findings
- Supabase project `ofyfausfhinwgrfmapgc` (Andertrack Staging), schema `at_*` and role-based RLS.
- One staged driver, `support@anderpointe.com`, license unverified and offline; no configured vehicles, assignments or queued dispatch requests at phase start.
- Driver acceptance requires **separate genuine verification** by operations; staging simulation does not confer it.
- Existing Vercel projects are in `mrianderson-8500`: `andertrack-web-staging` and `andertrack-driver-staging`.
- GitHub `main` remains untouched, and feature work stays stacked in draft PRs.

## Manual QA — no email required
1. Open the new **branch preview URL** for `andertrack-driver-staging`. Expect Vercel Deployment Protection login if enabled.
2. From the regular driver login screen select **Explore training simulation**.
3. Confirm the orange **TRAINING SIMULATION — NO LIVE OPERATIONS** warning and fictional location labels.
4. Accept the first fake offer. Advance `accepted` → `at_pickup` → `picked_up` → `in_transit`.
5. Confirm no `delivered` action, no real Google Maps links, no network request to Supabase from the simulator, and no lasting persistence.
6. Decline the second fake offer. It should return to `unassigned` in the simulator only.
7. Reset. Confirm both offers return and local action history clears.
8. Exit to the regular login screen. No authenticated privileges were granted.

## Manual QA — authenticated staging (pending)
1. Verify the exact branch preview URL appears in the Supabase staging Auth redirect allowlist.
2. Use an existing valid session or complete a single authorized login when email delivery permits. Never circumvent email quotas.
3. The profile must show **Driver**, **Class C**, **license unverified**, **offline**.
4. Readiness view must show membership/profile confirmed and verification/availability pending.
5. The assignment list must be empty. No offer or accept/advance RPC should be exposed to the unverified driver.
6. Admin/dispatcher must independently confirm that unverified/offline drivers are not eligible for live offers, and that role/tenant RLS prevents unauthorized reads.
7. Do not seed real-location jobs or mark license verified just to make QA pass.

## Promotion blockers
- Auth redirect allowlist and real sign-in test unverified
- Cross-organization authorization testing not yet completed
- No actual fleet vehicles, dispatch assignments, or certified driver credentials
- Database SECURITY DEFINER security-advisor notices require independent review
- Explicit owner approval needed for merging PRs and any production change

## Acceptance
- All GitHub CI tests + driver app Vite build pass.
- Latest driver feature branch creates protected Vercel **Preview** (not production).
- Training works anonymously without accessing or updating the real backend.
- Staging driver remains offline/unverified and production remains unchanged.
