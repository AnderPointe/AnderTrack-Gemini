# AnderTrack — Vercel Web + Driver PWA Plan

## Status: code prepared, Vercel connection blocked

Vercel's connected account returned **403 Forbidden** for the existing `andertrack` project under the team scope `flygeek88-5522` (team ID `team_iVqFZfXWdE2FWKHJW0DZdemY`). No project setting, deployment, Git connection, DNS record, domain, or environment variable has been modified.

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

## Access resolution required before linking

1. In ChatGPT, review the connected Vercel app and reauthorize it for the workspace that owns `andertrack`: `flygeek88-5522`. Vercel MCP's project read returned 403 and reported missing authorization for that scope.
2. If the user owns that Vercel team, open Vercel team/account settings and authorize the integration for the intended team. A successful login to another personal account does not grant team access.
3. Verify the existing Vercel `andertrack` project's **Git repository, production branch, deployed URL, environment variables by name only, project region, DNS and protection settings** before changing them.
4. Confirm AnderPointe GitHub App repository access includes `AnderTrack-Gemini`.
5. Verify both Preview environment values point to the same approved **staging** Supabase project, with matching publishable keys.
6. Allow Vercel preview URLs in that staging Supabase project's Auth redirect allowlist.
7. Only after approval, create/link a separate `andertrack-driver-staging` project rooted at `apps/driver`. Do not change the current `andertrack` production domain or repository until reviewed.

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
