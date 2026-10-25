# AnderTrack branded driver entry and public website

## Scope

Feature branch: `feature/brand-login-website`, based on the staging source branch `migration/andertrack-universal-os-phase1` at `1a7ccfc094dee2ba20081dd0abb9f06a257fc7e0`. This includes the newer standalone driver PWA and training/realtime QA work absent from main.

- Added `/concept`, an isolated command-center/driver-companion prototype adapted from the supplied HTML: selectable sample loads, simulated Three.js route, alternate route visualization, vehicle context, local chat per assignment, guarded status sequence and reset. Renderer, controls, resize observer, animation frame, geometries and materials are disposed on scene changes. Keyboard controls, mobile stacking and a WebGL fallback are included. The destructive reset SQL, hardcoded project/key, fake deployment controls and fake integration confirmations were excluded.
- Added a public website at `/website` with platform/division sections, driver/operations sign-in links, and the existing sample dashboard demo.
- Added optional `VITE_APP_SURFACE=website` to make the public website the root entry. Unset preserves the existing operations root. `/operations` always enters the operations workspace; `/driver` is a mobile-focused shared sign-in entry, not the standalone PWA.
- `VITE_DRIVER_APP_URL` directs public website driver links to the separate PWA. Unset falls back to `/driver`. The example uses the existing staging driver domain; use the matching environment's URL for future release builds.
- Restyled the standalone PWA login, primary buttons and base palette. Preserved magic links, pre-provisioned account restriction, retry cooldown, organization checks, assignment actions and training mode.
- Unconfigured previews show disabled sign-in controls and allow clearly labeled, local-only training. They do not send authentication requests.
- Corrected an existing `NAV is not defined` runtime crash in the command center by passing the universal navigation registry to the command palette.
- Entry pages load lazily so the public website does not immediately download the fleet dashboard bundle.

## Brand

Black `#000000`, charcoal `#121212`, teal `#087D79`, orange `#FF8A18`, white `#FFFFFF`, gray `#B3B3B3`, border `#292929`. Small teal text/icons sometimes use a lighter tint for contrast. Existing status semantics and map rendering are retained; this change does not replace the map engine or recolor every operational module.

`public/brand/andertrack-dark.png` and `apps/driver/public/brand/andertrack-dark.png` contain the same generated dark-background adaptation of the supplied logo. Built-in image generation prompt: preserve the AT/map/compass/container design, change white backdrop to black, change ANDERTRACK lettering to white, keep teal/orange details and orange tagline, crop with safe margin. No original upload was overwritten.

## Vercel connection verified

Account: `mrianderson-8500` / AnderPointe-AnderTrack 2.

- Website: `andertrack-web-staging`, project `prj_2vzEe7Kv5XvDdlWKF6i4H2oIdrKr`, repository root build.
- Driver: `andertrack-driver-staging`, project `prj_ChBad6YFfSFg6WFpOitio1z8zvTK`, `apps/driver` build.
- Both existing latest previews were READY. They remain protected by Vercel SSO; READY does not establish authenticated browser QA.
- Added `git.deploymentEnabled` false for this feature branch in both Vercel config files to prevent an automatic feature deployment. No Vercel project settings, env values, DNS, domains or protection settings were changed.

## Validation

- Root regression suite: 131 passing.
- Driver regression suite: 16 passing.
- Both production-format builds pass. The existing large fleet-dashboard chunk still produces Vite's bundle-size warning.
- Local browser checks at 390px and 1440px: website and PWA login render, images load, no horizontal overflow; disabled sign-in when unconfigured; training simulation opens; public demo opens without uncaught exceptions after the navigation correction. Concept checks cover alternate-route selection, chat across dispatch/driver views, status sequence, reset and mobile overflow.
- Live authentication, tenant data, protected Vercel previews and persistent database operations were not exercised.

## Release boundary

No PR merge, deployment, account creation, database write or backend migration is part of this change. A later authorized preview release should use this reviewed branch SHA, Vercel Preview target and verified staging environment. Set `VITE_APP_SURFACE=website` and `VITE_DRIVER_APP_URL` in the website project's Preview environment if its root should show the public site. Validate the Supabase redirect allowlist before sending real sign-in links. Production remains a separate release decision.
