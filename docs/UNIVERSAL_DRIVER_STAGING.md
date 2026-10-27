# Universal Driver staging workspace

The `/universal` route in the driver PWA adds the six-service black, teal, and orange interface. Existing driver login, training, assignment actions, public website, and command center remain available. This branch builds on `feature/brand-login-website` (956374c), preserving the newer PWA baseline.

## Available now

- Six service workspaces: 3PL, OTR, courier, food, rideshare, and trash removal.
- Home, filtered jobs, job details, sample earnings summary, account, and an explicit messaging placeholder.
- `/universal?demo=1` uses fresh in-memory examples and makes no database writes.
- `/universal` uses existing Supabase sessions, or existing-account password sign-in. Existing magic-link sign-in remains at `/`; navigate to Universal Driver after signing in.
- Preferences and synthetic test-job progress persist only when `VITE_DRIVER_TEST_WORKSPACE=true` and the configured API URL exactly matches Andertrack Staging (`ofyfausfhinwgrfmapgc`). The flag is enabled only for the driver project's Vercel Preview environment.

## Database

Migration `20261025134312_universal_driver_test_workspace.sql` was applied to Andertrack Staging. New tables: `at_driver_test_preferences`, `at_driver_test_jobs`, and `at_driver_test_job_events`. Operational assignments and existing safety functions are untouched.

RLS requires the signed-in driver to own the row and retain membership in its organization. Drivers can edit only a job's status column. Database triggers enforce sequential transitions, increment revision, and append audit history; clients cannot forge history, reassign ownership, or change prices. The client supplies the previously read revision to reject stale competing updates.

The staging-only fixture script creates six clearly marked TEST jobs for the existing profile named `AnderTrack Staging Driver`. It creates no Auth accounts and can be rerun without duplicating fixtures.

## Verification

- 134 root tests and 16 driver tests pass; both Vite builds succeed.
- `tests/sql/universal_driver_test_security.sql`: authenticated valid transition, skipped-step rejection, stale revision rejection, protected price column, audit insert denial, preference upsert, cross-driver read isolation, anonymous denial. Mutations roll back.
- Security advisor has no findings on the new tables or private trigger functions. Existing public DVIR/service RPC advisories and disabled leaked-password protection remain outside this change.
- Actual existing-account sign-in and browser-to-database persistence need a real staging session; SQL role simulation does not establish end-to-end Auth QA.
- The initial Vercel preview failed with `module_not_found`. Universal Driver source was subsequently placed entirely inside `apps/driver` so its build does not depend on root-package dependencies. The corrected commit `c20133d` reached READY in Preview deployment `dpl_BgTheQBM7y9aoLb2KjinxDreVrL9`.
- Vercel team authorization and browser sign-in succeeded. Browser QA on the corrected preview confirmed all six service filters, OTR accept/arrival/pickup/completion, the completed sample earnings total, and the explicit messaging placeholder. These demo actions made no database writes.
- The non-demo `/universal` route correctly renders the staging driver authentication gate. Vercel authentication is separate from Supabase driver authentication; browser-to-database persistence remains unverified until an existing staging driver signs in.

## Limits

This is a functional staging slice. Maps are labeled illustrations, earnings are synthetic, messaging is a placeholder, and there is no GPS upload, navigation integration, operating approval, live booking, payment processing, certified ELD/HOS, or customer order intake. Selecting a service does not approve a driver to operate it.

Use Preview deployments only. No production promotion, main merge, or domain changes are part of this work.
