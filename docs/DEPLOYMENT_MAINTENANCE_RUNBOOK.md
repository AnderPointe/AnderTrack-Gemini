# AnderTrack deployment, maintenance and support

Updated October 27, 2026 (America/Chicago). Applies to `AnderPointe/AnderTrack-Gemini`. This is the current operational runbook; older domain instructions are historical. Production remains outside this change.

## What is in place and what is not

| Area | Implemented foundation | Still required before public launch |
|---|---|---|
| Release checks | Lockfile installs, Node 24, regression tests, builds, dependency audits; paired-deployment smoke script | Required GitHub/Vercel checks and protected release environment must be verified/configured by the release owner. A green workflow alone does not block an unprotected merge. |
| Monitoring | `/api/health` in website and driver; manual paired-release health/static-entry check with latency output | Scheduled external uptime checks, persisted latency/error metrics, dashboards and an actual alert recipient/owner are not configured by this change. |
| Updates | Reviewed PRs, preview testing, staging-first migrations and rollback procedure below | Appoint release and database owners; record maintenance windows and backup/restore evidence. |
| Security | Auth/RLS/private proof storage, audited state transitions and CI dependency checks | Close known advisor findings; verify MFA, distributed abuse controls, session/revocation policy and restore drills. |
| Support | Intake, severity, escalation and incident templates below | Assign a staffed private support channel, on-call owner and response coverage. No ticketing provider, public status page or staffed SLA is created here. |

No new third-party telemetry receives customer data. This change creates no cron job, recurring automation, alert subscription, paid monitoring service, database migration or production promotion.

## Phased launch

| Stage | Cohort | Evidence required to advance |
|---|---|---|
| 0: Internal staging | Admin/release owner and dispatcher; synthetic customers/loads | Exact website and driver commit; all CI checks; paired smoke; migrations/RLS reviewed; controlled rollback tested; support owner named. |
| 1: Controlled pilot | One dispatcher, two appropriately qualified drivers, one customer and one warehouse operator in an isolated acceptance organization | Real sign-in and role isolation; six service-specific request flows where applicable; assignment races, two-way messaging, consent/freshness GPS, private photo completion, stock conservation and a full supported shift without unresolved critical issues. |
| 2: Expanded pilot | Add a second operational team/shift, then approximately double measured pilot traffic | Sustained baseline/2× measurements, query/connection monitoring, no duplicate transitions or privacy failures, real small-screen/poor-network acceptance and operator feedback resolved. |
| 3: Production | Explicitly approved organization-by-organization rollout | Production environment isolation, exact auth redirects, verified backup/restore, agreed support coverage, monitoring alerts delivered to an owner and a signed release record. |

Cohort control is an operational requirement, not an implemented feature-flag service. Use reviewed organization provisioning/access to restrict pilot participants; do not open registration to the public and assume the cohort is isolated. Never mark an unqualified driver verified or bypass safety gates for a test. Background GPS and offline completion are not supported release promises; establish an approved dispatcher fallback before field testing.

## Exact-release check

Both frontends now expose `GET /api/health` and `HEAD /api/health`. GET returns only `{status, check, surface, release}`. It is public, uncached, read-only and makes no database, Auth, GPS, storage or AI calls. `release` is the validated full `VERCEL_GIT_COMMIT_SHA`, or null when unavailable. `check: liveness` means the function responded; it is **not** database readiness, uptime history or proof that customers can complete loads.

After both Git preview deployments report READY for the reviewed commit:

```bash
WEBSITE_PREVIEW_URL='https://<exact-website-deployment>.vercel.app' \
DRIVER_PREVIEW_URL='https://<exact-driver-deployment>.vercel.app' \
EXPECTED_COMMIT='<full-40-character-reviewed-sha>' \
node scripts/release-smoke.mjs
```

Replace placeholders with the actual immutable deployment origins. The script checks each health surface/commit, the website `/website` or driver `/` HTML, and the referenced built JavaScript entry. It rejects redirects, unexpected status/MIME, missing bundles and mismatched versions. Each request has a five-second timeout. It uses no credentials and accepts only plain HTTPS Vercel origins with no URL tokens, paths, queries or fragments. A protected deployment correctly fails this public probe; use the approved protected-deployment testing workflow rather than disabling protection.

The optional manual GitHub workflow **Check paired staging deployments** runs the same command with the two origins and expected commit supplied as dispatch inputs. GitHub requires a workflow to exist on the default branch before manual dispatch is available; until then run the script locally or from an approved runner. This workflow does not deploy, promote, schedule polling or certify full business readiness.

Critical journey acceptance is separate: real operator sign-in → customer request/quote → driver queue/acceptance → message both directions → scoped live map → private photo upload → delivery completion → customer tracking cutoff. Record tenant isolation, data writes and actual device behavior, not only screenshots or green health checks. Test warehouse movement and physical reconciliation independently of delivery so stock is not deducted twice.

## Monitoring plan

These are initial operational targets to agree before launch, not a purchased SLA or observed production performance.

| Signal | Initial trigger | Owner action |
|---|---|---|
| Website/driver health + static entry | Proposed external probe every minute; two consecutive failures | Check deployment/protection status and provider incident status; distinguish public probe failure from an outage. |
| Business operation latency | p95 critical reads >1s or writes >2s for 10 minutes | Inspect scoped query plans, payloads, polling rate, connection/CPU/lock metrics and recent releases. |
| Error rate | Server/application failures >1% over 10 minutes with meaningful traffic | Group sanitized error codes by release/surface; reproduce in staging; suspend rollout if persistent. |
| GPS freshness | Assigned in-transit driver has no valid fix within the existing 60-second freshness boundary | Show stale state; ask dispatcher to follow the approved contact/fallback procedure. Never infer that a stale marker means a vehicle stopped. |
| Messaging / queue / proof | Repeated sends, acceptance failures, missing proof or privacy/safety interlock failure | Stop expansion; preserve request identifiers privately; verify business rules before retrying. Privacy/safety failures are critical. |
| Database / storage | Sustained >80% of provisioned resource/connection/storage capacity or rising waits | Database owner investigates; verify backups and provider limits before scaling. Threshold depends on actual plan. |
| Dependency / security | New high/critical advisory, access anomaly or suspected cross-tenant disclosure | Triage affected version/entry point; contain access and initiate security incident procedure. |

Use Vercel runtime logs/Observability and Supabase logs/metrics/advisors for diagnosis, then choose an error/uptime provider only after its data handling and costs are reviewed. Configure recipients and test alert delivery before relying on it. Retention, sampling, budget and a missing-heartbeat alarm must be explicit. Do not store locations, message bodies, proof images, customer addresses, passwords, tokens or full API payloads in general error logs. A support correlation ID should be opaque and linked to protected server records, not encode personal details.

## Update cadence and release checklist

Recommended cadence (not scheduled by this document): review pilot health each shift; triage issues daily during pilot; review dependencies/advisors weekly; review capacity/access monthly; perform a restore and rollback exercise before launch and after material storage/auth changes. Urgent vulnerabilities follow incident handling rather than waiting for a maintenance window.

For each release:

1. Record scope, reviewed commit, repository, Vercel team/projects, affected roles, migration versions and production/staging target. Keep website/driver API contracts backward compatible during staggered deployment.
2. Require tests, clean builds and dependency checks. Review secrets exposure, tenant boundaries, migration plan and deployment checks. Do not expose protected credentials to unreviewed code.
3. Apply additive compatible migrations to staging first, test actual role behavior and negative paths, then run the full device/journey acceptance relevant to the change. Backups must be restorable, not merely shown as enabled.
4. Verify both exact preview releases using the paired script and collect business journey results. A Vite preview server does not run Vercel functions; health endpoints require the actual platform or a suitable function runtime.
5. Before production, obtain the release owner's explicit approval for the concrete tested release and production migration plan. Preview variables and staging database guards must not be silently reused/removed.
6. Stage a production build with production configuration, run production-safe checks, and promote that tested build. A preview build is not assumed byte-for-byte identical to a production rebuild. Never run synthetic write fixtures against production.
7. Observe pilot cohorts, errors, latency and operator feedback during the agreed window. Pause expansion if thresholds or correctness gates fail. Record the approved next cohort.

## Rollback and recovery

- Stop rollout and identify whether the defect is frontend/API, data, identity, provider outage or configuration. Preserve restricted evidence; do not overwrite it with retries.
- For an application regression, release owner selects the recorded last-known-good **compatible** website and driver production builds, uses Vercel's supported rollback, and verifies paired versions plus critical read/write journeys. A version mismatch may be temporarily allowed only with documented contract compatibility; the paired script deliberately requires equality by default.
- A frontend rollback does not reverse database migrations or data writes. Prefer expand/contract migrations and forward fixes. Never automatically drop tables/columns or restore a backup over live writes.
- If data recovery is necessary, database owner restores into an isolated project first, verifies integrity/access and plans reconciliation. Obtain explicit approval for any production replacement or data loss window.
- Vercel rollback can affect future automatic domain assignment. Check the deployment state and production routing before resuming normal releases. Do not assume the next Git push automatically resumes the intended promotion behavior.
- Re-run health, signup/role checks, messages, GPS cutoff, queue and proof flows. Document impact, remaining risk, rollback commit and decision to resume.

## Support intake and incident handling

Use a private staffed channel for customer/driver/business incidents. This repository may be public; do not upload operational screenshots, proof photos, exact routes, emails, addresses or user identities to public issues. Use synthetic reproductions in public development reports.

Minimum private intake:

- Observed time and timezone; website or driver; release SHA from the deployment record.
- Task attempted, expected versus actual behavior, reproducible steps and error code.
- Affected role and operational impact. Include tenant/order identifiers only in the restricted incident system.
- Device/browser/network conditions and whether tracking/location permission was active. Do not ask for passwords or tokens.
- Safe workaround tried, support owner and next update time.

| Severity | Example | Pilot response objective |
|---|---|---|
| P0 | Cross-company disclosure, compromised account, unsafe assignment/safety bypass, material data corruption | Suspend affected access/rollout immediately; assigned security/release owner coordinates containment and communications. |
| P1 | Core booking/dispatch/tracking/proof flow unusable for an active cohort | Pause expansion, use the approved operational fallback, investigate/rollback with release owner. |
| P2 | Limited issue with a safe workaround | Capture reproducible steps and prioritize a reviewed fix. |
| P3 | Cosmetic issue or improvement | Add to the product backlog and validate with users. |

Response times depend on assigned staffed coverage; this runbook does not promise a 24/7 service. For suspected security incidents, revoke affected sessions/credentials using approved provider controls, preserve evidence and assess privacy notification obligations with the responsible business owner. Do not assume deleting an account invalidates all existing tokens. Communicate only through authorized channels; this change sends no messages.

Incident/release record template:

```text
Incident or release ID:
Environment / affected surfaces / exact commits:
Start time + timezone / detection source:
Impact and severity / restricted evidence location:
Incident commander / release owner / database owner / support owner:
Containment and approved workaround:
Last-known-good build / migration compatibility / restore point:
Actions, verification evidence and rollback decision:
Next communication time / closure time:
Root cause / prevention item / owner / due date:
```

## Remaining launch blockers

Named operators/on-call/support channel; tested external alerts; protected release gates; exact Auth/provider settings; physical-device/background/offline expectations; real simultaneous communication tests; representative 2× load evidence; existing security/performance advisor follow-up; verified restore/retention plan; and an explicitly approved production rollout. Refer to `TECH_STACK_AUDIT_2026-10-27.md` and `CORE_FEATURE_COVERAGE_2026-10-27.md` for implementation gaps.
