# AnderTrack Phase 5 — Safe Dispatch QA & Realtime Recovery

**Release state:** Draft-only, stacked on Phase 4; **do not merge or promote production**.

## Delivered code

- `apps/driver/src/dispatch-training.js`: pure, deterministic, **fictional** dispatcher queue and driver workflow state machine. All actors and locations are clearly fictional and use the fake tenant `qa-fictional-tenant`.
- `apps/driver/src/DispatchTraining.jsx`: two-pane local dispatcher and driver sandbox, queue head, qualification guardrails, Class C vehicle matching, mock offer, accept/decline, driver progress, fake event timeline.
- `apps/driver/src/TrainingMode.jsx`: entry from pre-login driver training, no production accounts needed.
- `apps/driver/src/sync-feedback.js`: normalized server subscription status, bounded 30s polling and 450ms event coalescing interval.
- `apps/driver/src/App.jsx`: authenticated driver subscription status badge; subscribe on scoped organization/user, re-query authorized rows on event, refresh only visible browser sessions every 30 seconds, refresh on connectivity or tab return, discard stale in-flight queries on sign-out.
- Unit tests check FIFO blocking, active driver exclusivity, unauthorized driver mutation rejection, fake tenant isolation, no privileged delivery-complete transition, subscription labels, and fallback cadence.
- **No new database migrations, service-role secrets, bypass tokens, DNS changes or actual dispatch objects**.

## Actual staging RLS checks (read-only, completed)

Environment: `Andertrack Staging` / `ofyfausfhinwgrfmapgc`, project status active.

Executed isolated PostgreSQL `BEGIN READ ONLY` sessions with `SET LOCAL ROLE authenticated`
and the scoped `request.jwt.claim.sub` value, then `ROLLBACK`. No records changed.

| Test | Visible memberships | Visible driver profiles | Visible organizations | Visible assignments | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| The approved staging driver | 1 | 1 | 1 | 0 | PASS (own records visible) |
| A synthetic unrelated subject | 0 | 0 | 0 | 0 | PASS (unrelated access denied) |

**Limits:** At time of verification, staging had just **one organization and no assignments, vehicles or dispatch requests**. These checks do NOT establish full cross-organization isolation, assignment ownership isolation, concurrent RPC correctness, or production readiness. The unknown-subject check is an unrecognized identity; it is not a second authorized tenant. No SQL was used to impersonate a production user or mutate role permissions.

To repeat in a tightly controlled read-only staging session:

```sql
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub', '<approved-staging-user-uuid>', true);
SET LOCAL ROLE authenticated;

SELECT current_user, auth.uid(), 
  (SELECT count(*) FROM public.at_organization_members) AS visible_memberships,
  (SELECT count(*) FROM public.at_driver_profiles) AS visible_profiles,
  (SELECT count(*) FROM public.at_organizations) AS visible_organizations,
  (SELECT count(*) FROM public.at_assignments) AS visible_assignments;
ROLLBACK;
```

*Use only in the approved staging project under an authorized operator. Replace the placeholder with a staging-only test principal. Validate results under an actual browser session separately.*

## Manual training QA (no email required)

1. Open the Phase 5 **driver feature-branch preview** behind Vercel Deployment Protection.
2. Choose **Explore training simulation** then **Open Dispatch QA Lab**.
3. The sample dispatcher queue starts with Alex (verified Class C) then Morgan (offline, unverified).
4. Offer `QA-LOAD-001` to FIFO head with the fictional Class C cargo van; it appears immediately in Alex's fake driver panel.
5. Switch fake driver to Morgan: Alex's offer must disappear. Switch back to Alex, accept and advance to `in_transit`.
6. Confirm **no delivered/ePOD action exists** and none of the training flows send requests to Supabase.
7. Observe the remaining FIFO head Morgan is blocked from claim. Only a simulated withdrawal or reset clears that request—no silent skip.
8. Reset the sandbox; initial queue and fake orders should be restored without persistence.

## Authenticated driver sync QA (pending)

- Confirm the exact **new preview URL** is allowed in staging Supabase Auth Redirect URLs.
- Sign in through the existing authorized user/session; do not request repeated emails.
- Observe driver organization and role; staging driver remains Class C **license-unverified** and **offline**.
- Confirm status badge reports only `Realtime listening` on actual `SUBSCRIBED` callback. For `CHANNEL_ERROR`/`CLOSED`/`TIMED_OUT`, it reports degraded and continues periodic visible-tab refresh.
- Confirm successful scoped reads update the last-refresh indicator. Unrelated organization data must never appear even if a notification is received.
- Use separate authorized test organizations and preapproved fabricated assignments in a later isolated fixture branch before exercising RPCs or cross-org data-access tests.
- Simulate disconnect/reconnect, fast successive notifications, tab hide/show and sign-out race with authenticated staging test sessions.

## Promotion blockers

- SMTP and Auth redirect allowlist may prevent authenticated browser testing; *not needed to run the sandbox*.
- Real Realtime event propagation and reconnection behavior are not yet browser-verified.
- True two-tenant cross-organization RLS fixture test is not yet run.
- Concurrency race testing of real FIFO and offer RPCs remains pending.
- Current staging user is unverified/offline; no legitimate assignment or vehicle is ready for real dispatch.
- Staging security advisor has previously flagged signed-in access to some SECURITY DEFINER functions and disabled leaked-password protection. Review before production authorization.
- Explicit approval is mandatory for production promotion, merging stacked draft PRs, changing DNS, modifying server authorization, or staging fixture creation.

**Acceptance for code-only phase:** both app builds, regression and driver unit tests green, draft PR remains unmerged, and protected branch previews reach READY.
