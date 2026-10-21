# AnderTrack Driver PWA

A separate Vite + React mobile-friendly web app for approved drivers. This is built from the same `AnderTrack-Gemini` Git repository as the dispatcher website, but can be deployed as a **separate Vercel project** with `apps/driver` as its root directory.

## Training and readiness checks
- Unauthenticated **fictional training simulation** (local React state only), with clearly marked fake loads and no Supabase calls or GPS.
- Authenticated read-only onboarding checklist reflecting membership, verified license, availability, and browser connectivity.
- Neither feature changes backend qualifications or authorizes real dispatch.

## What works in code
- Supabase magic-link login for existing authorized users (`shouldCreateUser:false`).
- Only Driver membership organizations can access the workspace.
- Lists driver-owned `at_assignments` scoped by `organization_id` and `driver_user_id`. Supabase RLS remains mandatory.
- Offers: accept/decline through existing `at_respond_assignment` RPC.
- Delivery progress: supported `at_advance_assignment` states only; no direct table mutations.
- Opens standard Google Maps directions from real pickup/drop-off addresses. Commercial restrictions/ETA are **not** verified.
- Optional **local-only** device location, after explicit browser permission. No GPS upload.
- Mobile layout, installable PWA manifest, offline shell; server data is not cached by the service worker.

## Not active
- Food delivery and passenger bookings, tips, payouts, in-app turn-by-turn navigation, continuous background tracking, automatic dispatch, proof of delivery, and native iOS/Android packaging.
- This app does not bypass pending Phase 2 eligibility, safety, or dispatch protections.

## Local development (staging credentials only)
```bash
cd apps/driver
npm install --no-audit --no-fund
cp .env.example .env.local
# Populate VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm test
npm run build
npm run dev
```

Never put a `service_role` key in a `VITE_*` variable or commit `.env.local`.

## Vercel settings
- Framework: Vite
- Root Directory: `apps/driver`
- Install: `npm install`
- Build: `npm run build`
- Output: `dist`
- Vercel project suggestion: `andertrack-driver-staging`
- Preview variables: staging-only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not connect to production Vercel or production Supabase before the access review, DB verification and user approval. Full release gates in `docs/VERCEL_WEB_DRIVER_PLAN.md`.
