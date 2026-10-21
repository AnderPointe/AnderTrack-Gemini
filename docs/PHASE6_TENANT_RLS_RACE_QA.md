# AnderTrack Phase 6 — Staging Tenant Isolation and Dispatch Collision Review

**Release state:** Draft-only feature branch stacked on the latest integration branch `feature/driver-phase4-training-staging-qa`. At verification, PR #4 and #5 had been merged into their respective *feature* branches; PR #3 remains a draft, and GitHub `main` is unchanged. No production approval has been given.

## What was implemented

1. In `apps/driver/src/dispatch-training.js`, fictional dispatcher and driver actions can require a matching `expectedRevision`. A stale second claimant is rejected instead of incorrectly accepting both requests.
2. `apps/driver/src/DispatchTraining.jsx` adds **Simulate competing dispatch claims**. It runs two identical requests in local browser state and labels the demonstration as simulated, **not evidence of true Supabase/Postgres concurrency**.
3. Automated tests in `apps/driver/tests/dispatch-training.test.mjs` cover the optimistic stale-claim rejection and a stale driver acceptance.
4. Two repeatable SQL scripts are checked in under `tests/sql/`. They explicitly require the approved empty single-organization staging configuration; both start `BEGIN`, create temporary fictional fixtures and end with `ROLLBACK`. Static safety checks are in `tests/phase6-sql-safety.test.mjs`. Never run these against production or any environment with real jobs.

## Actual staging results (2026-10-20, U.S. Central)

Project: `ofyfausfhinwgrfmapgc` — **Andertrack Staging**.

### Two-tenant RLS test — PASS

Using a single rollback-only transaction, created two distinct ephemeral organizations (A and B), one scoped administrator for A, one scoped driver for B, distinct vehicles, driver profiles, and three cancelled/unassigned fictional assignments. `SET LOCAL ROLE authenticated` and scoped `request.jwt.claim.sub` values were used for each access check. Both results were `PASS`.

| Metric | Admin tenant A | Driver tenant B |
| --- | ---: | ---: |
| Visible tenant A organizations/memberships | 1 | 0 |
| Visible tenant B organizations/memberships | 0 | 1 |
| Visible tenant A vehicles | 1 | 0 |
| Visible tenant B vehicles | 0 | 1 |
| Visible tenant A assignments | 1 | 0 |
| Visible tenant B assignments | 0 | 1 |
| Visible tenant A profiles | 0 | 0 |
| Visible tenant B profiles | 0 | 1 |

Driver B saw only **one** of the **two** B profiles and only their own one of the two cancelled B assignments. The second B driver profile was a temporary other-user fixture. This directly exercises driver-level row filtering, not only tenant filtering.

**Important constraints:** Testing with `SET LOCAL ROLE` and a simulated JWT subject inside an authorized database session is a database RLS regression test; it is **not** a browser login test with two independent real JWTs. No Realtime event propagation was validated by this SQL test.

### Active vehicle collision — PASS

A separate rolled-back transaction inserted a fictional enabled Class C vehicle, temporary driver profile and first `offered` assignment. A second `offered` assignment for the **same vehicle** was rejected by the existing database trigger:

```text
Vehicle has another active assignment; dispatch denied
```

The trigger test is sequential within a single DB transaction. It is **not** a simultaneous two-connection race test. It also does not validate driver license checks in protected offer RPCs; a privileged fixture insert deliberately bypasses the application RPC path.

### Cleanup — PASS

After the RLS test, a separate query confirmed:
- **0** `PHASE6` organizations, vehicles or assignments remained;
- original staging organization count **1**;
- original assignments and vehicles both **0**;
- the existing test driver remains Class C, **unverified** and **offline**.

No `auth.users` rows, email settings, role grants, DNS, Vercel production targets or persistent driver qualifications were changed.

## Reproducing safely

1. Verify the connected project ID is exactly `ofyfausfhinwgrfmapgc`, and that the staging project still has **one** `AnderPointe` organization, **zero** vehicles and **zero** assignments. The scripts abort otherwise.
2. Review the SQL before executing it. Both scripts create only fictional records inside their own transaction and end with `ROLLBACK`.
3. Run `tests/sql/phase6_rls_isolation_rollback.sql` and inspect both `verdict` rows.
4. Run `tests/sql/phase6_vehicle_collision_rollback.sql` and inspect the expected trigger rejection.
5. Run a separate post-transaction query to verify there are no fixture identifiers left.
6. Run `npm test`, `npm run build`, `npm --prefix apps/driver test`, and `npm --prefix apps/driver run build`.
7. Keep this change stacked in a **draft PR** until live authenticated staging sessions can validate Supabase Auth, realtime synchronization and actual concurrent RPC requests.

## Open release gates

- **Simultaneous multi-session RPC concurrency:** not yet tested. Requires independently authenticated staging sessions and a safe dedicated fixture org with approved credentials; the one-transaction test cannot prove race safety.
- **Browser E2E RLS/realtime:** not yet tested; exact Preview URL must be allowed under Supabase Auth Redirect URLs, and email limits may still block sign-in.
- **A real staging driver** remains unverified and offline. Do not verify a real license just to make a demo pass.
- **Security review:** Supabase previously raised warnings about signed-in access to `SECURITY DEFINER` functions and leaked-password protection disabled. Review before any real operation.
- **Production:** no merge to `main`, no production domain or database change.

## Trust boundaries

Simulation actions are purely local and not database transactions. Staging SQL tests validate RLS and trigger behavior but do not make the frontend test suite an authorization boundary. Actual dispatch decisions must remain behind the existing protected server RPCs.
