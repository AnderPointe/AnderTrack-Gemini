# AnderTrack — Vercel Web + Driver PWA Plan

## Status: isolated staging projects live; production project unchanged

The former Vercel workspace access issue was resolved by targeting the user's new `mrianderson-8500` account. Two **staging-named** Vercel projects now exist: `andertrack-web-staging` and `andertrack-driver-staging`. Git branch previews are built there and the Supabase browser-safe staging environment variables are configured. Both use the existing **Andertrack Staging** Supabase project (`ofyfausfhinwgrfmapgc`); no old production projects, DNS or production database were changed.

**Important:** Initial deployments to these separate staging-named projects were classified as `production` by Vercel; subsequent non-main branch previews have `target: null`. Only the preview deployments should be used for QA. Production `main` and all stacked PRs are unmerged.

The current repository source of truth is `AnderPointe/AnderTrack-Gemini`. Phase 1 is draft PR #1; Phase 2 is draft PR #2. This feature is to be reviewed in a separate stacked PR on top of Phase 2. Keep every PR unmerged pending approval.

## Planned architecture

```text
One GitHub repository: AnderPointe/AnderTrack-Gemini
├── /                       -> Vercel Project: existing AnderTrack website
│   ├── React + Vite UI
│   ├── Universal Command Center, 3PL, hotshot, warehouse
│   └── Class C Local Services (courier/food/passenger phases)
└── /apps/driver            -> NEW Vercel Project: AnderTrack Driver PWA
    ├── React + Vite UI
    ├── Supabase login and verified organization membership
    ├── Read-only authorized assignments and protected status RPCs
    └── PWA manifest, responsive driver UI, opt-in local GPS

Shared backend: Supabase Auth, Postgres RLS, existing at_* secure RPCs
```

**Why two projects?** Separate production/preview URLs, releases, mobile-focused UI, caching, and permission checks. The websites share a verified Supabase project but never share service-role secrets or direct assignment updates.

## Current staging integration

- Website Vercel project: `andertrack-web-staging`, root directory `/`.
- Driver Vercel project: `andertrack-driver-staging`, root directory `apps/driver`.
- Repository: `AnderPointe/AnderTrack-Gemini`, using stacked feature branches for QA.
- Vercel Preview and Production env targets *of the staging-named projects only* point to `ofyfausfhinwgrfmapgc` with the public publishable key. Existing live projects are untouched.
- Auth Redirect URL allowlist **still requires manual verification**. Do not assume login will work based on a successful build.
- Staging account `support@anderpointe.com` is a driver in the AnderPointe staging organization; initial state Class C, license unverified, availability offline.
- Next safe milestone: nonpersistent training walkthrough and authenticated readiness checks in the Driver PWA. See `docs/PHASE4_DRIVER_STAGING_QA.md`.

## Safe deployment strategy

- `main` still contains only the bootstrap README; **do not set up default-branch auto-deploy expecting a running app**.
- The complete Vite site currently lives in the isolated Phase 1 migration branch, with Phase 2 changes stacked above it.
- Keep site/driver on review branches until CI and staging QA pass. After approved merges and environment review, configure Git integration and separate release pipelines.
- Do not use `andetrack.com` or a live driver subdomain until explicit DNS/domain approval.
- If a preview deployment is requested, deploy an exact reviewed branch SHA with Preview target and validated staging variables. Never deploy with `--prod` by default.

## Driver security checklist

- Auth: Magic links only for pre-provisioned users, user scope derived from Supabase token; no UI-only auth trust.
- Role: Driver membership is required; dispatcher/admin roles are not silently promoted to drivers.
- Data: Queries filter by both `organization_id` and `driver_user_id`. Server-side RLS must independently enforce both.
- Commands: Uses `at_respond_assignment` and `at_advance_assignment`; never direct DML to `at_assignments`.
- Location: Only on-demand local geolocation; no background tracking, no telemetry upload and no server-side location writes.
- Service-specific types: Class C legacy jobs are not inferred to be food deliveries or passenger rides. Both require independent backend and licensing rules.
- Proof of delivery: Locked until protected POD flow is connected; direct `delivered` status mutation is not exposed.
- Payments and earnings: Not implemented; do not display invented amounts.

## Verification before app launch

- [ ] GitHub CI site regression tests pass
- [ ] Driver unit tests and Vite build pass
- [ ] App installs as a PWA in an HTTPS preview supported browser
- [ ] Authenticated staging sign-in works for approved Driver account
- [ ] No-driver, driver and cross-organization privacy tests pass
- [ ] Existing assignment offer, decline and progress actions call authorized RPCs
- [ ] UI handles offline, expired links, login redirects and empty jobs
- [ ] Vercel preview status and protection verified
- [ ] Main application regression and domain settings untouched
- [ ] Explicit approval before production merge/deploy/domain configuration

## Native mobile apps

Vercel hosts the **web/PWA version**. App Store and Play Store distribution needs a native packaging or React Native/Expo project, signing, mobile permissions, store review and separate QA.
