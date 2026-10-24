# Phase 1 — Universal Logistics OS command center and navigation

## Repository and release boundary
- Repository: `AnderPointe/AnderTrack-Gemini`.
- Base/source application snapshot: `AnderPointe/Andertrack` at `5dae4860439993432b1c110c70ec996a3664749b`.
- Implementation branch: `migration/andertrack-universal-os-phase1`.
- Default `main` remains a bootstrap README. No production rollout, DNS changes, database writes, or PR merge has been performed.
- This repository is a **source snapshot migration**, not a transplantation of previous Git/PR history.

## Reference concepts brought together

The supplied dashboard concepts establish one identity for:
- Neon 3D fleet command center: global dashboard and map-dominant operations workspace.
- Orange logistics dashboard: dispatch attention, alerts, route performance and per-division KPIs.
- Tractor/vehicle dashboard and video: reusable 3D vehicle detail and model viewer.
- Delivery dashboard: shipment pipeline and last-mile progress.
- Dispatch dashboard concepts: realtime dispatch queue and driver context.
- Map UI concept: large map, vehicle position, overlays, route and selected-vehicle drawer.

**Phase 1 scope:** navigation and division entry points; existing modules remain unchanged. The 3D map engine and telemetry accuracy are not being rebuilt or claimed complete in Phase 1.

## Architecture decisions

1. **One React application and one shared command center.** Reuse the existing `OpsCommandCenter.jsx`, `LiveWorkspace.jsx`, fleet, warehouse, delivery, Class C, and GPS components.
2. **Centralized typed-by-convention navigation data.** `src/lib/universal-navigation.js` owns grouped navigation, view identifiers, display metadata, and planning workspaces.
3. **Existing view IDs preserved.** The 16 original internal view IDs remain accessible. Grouping is presentation-only.
4. **Six primary business entry points.** 3PL freight, hotshot, warehouse/yard, Class C local courier, Class C food delivery, Class C passenger services.
5. **Class C scope remains strict.** Food delivery, local courier and passenger marketplace features belong under Class C Local Services—not the general 3PL freight flow.
6. **Never invent operational state.** Planned services show architecture previews with the label `Planned`. No food order, ride booking, charge, or special freight tender is generated.
7. **Navigation does not grant access.** Existing authenticated Supabase/RLS boundaries and server-side operations remain responsible for authorization; planned panels hold no tenant data.
8. **Avoid duplicating existing components.** Existing warehouse and Class C fleet screens open directly; freight/hotshot and future marketplaces link to existing verified foundations.
9. **Map strategy:** preserve Leaflet live location map and current Three.js vehicle viewer. Evaluate 3D geospatial upgrades in a separate phase after verifying telemetry/renderer integrations.

## Files changed in Phase 1

| Path | Intent |
|---|---|
| `src/lib/universal-navigation.js` | Canonical division groups, existing/planned view metadata and quick links |
| `src/features/live/UniversalDivisionWorkspace.jsx` | Six-division launchpad and honest planned-service workspaces |
| `src/features/live/universal-workspace.css` | Dashboard cards, grouping, responsive sidebar |
| `src/features/live/OpsCommandCenter.jsx` | Wire navigation groups, division launchpad and planned views |
| `tests/universal-navigation.test.mjs` | Legacy-ID regression, unique view IDs, correct Class C nesting |
| `docs/PHASE1_UNIVERSAL_OS.md` | Phase plan, reuse map and release gates |

## Workspace route map (internal view IDs, not URL routes)

| Division | Target view | Phase 1 state |
|---|---|---|
| Universal Command Center | `overview` | Existing, with six-division launchpad |
| Freight / 3PL | `freight-3pl` | Planned domain preview; uses existing `dispatch`, `journeys` |
| Hotshot & Expedited | `hotshot` | Planned domain preview; uses existing dispatch planner |
| Warehouse & Yard | `warehouse` | Existing warehouse module |
| Class C: Local courier | `local-courier` | Planned dedicated marketplace; uses existing `class-c` fleet |
| Class C: Food delivery | `food-delivery` | Planned; no merchant, menu, cart or payment transactions |
| Class C: Passenger services | `passenger-services` | Planned; no ride requests, pricing or ride tracking service |
| Fleet 360 | `fleet`, `fleet-health`, `intelligent-fleet` | Existing components |
| Analytics, safety, settings | `analytics`, `intelligence`, `settings` | Existing components |

## Reused components

- `OpsCommandCenter.jsx`: main dashboard, authenticated demo/live switching, existing metrics and dispatch overlays.
- `LiveWorkspace.jsx`: session and organization scope, Supabase authorization-aware data loading.
- `FleetMap.jsx`: current Leaflet map (not fully integrated 3D map); GPS age checks.
- `ClassCOpsDashboard.jsx`: fleet, inspection and Northvale-style panel.
- `ModernOperationsDashboards.jsx`: warehouse and delivery views.
- `DispatchRequestQueue.jsx`, `DispatchPlanner.jsx`: existing dispatch planning and queue.
- `FleetHealthDashboard.jsx`, `Vehicle3D.jsx`: fleet intelligence and visual reference reuse.

## Release gates

- [ ] `npm install --no-audit --no-fund` succeeds in isolated CI/workspace.
- [ ] `npm test` passes, including `universal-navigation.test.mjs`.
- [ ] `npm run build` passes with no unresolved JSX imports.
- [ ] Responsive navigation verified at desktop, narrow rail and mobile drawer widths.
- [ ] Keyboard controls, headings, labels, and planned-state indicators verified.
- [ ] Demo counts visibly labeled sample; live counts use only RLS-scoped records.
- [ ] Cross-tenant regression tests and authenticated staging UI QA completed.
- [ ] Prior Phase 10 fleet safety interlocks checked before any assignment writes.
- [ ] Review Vercel Git settings; do not attach production domain or enable production deployment.
- [ ] Written authorization before merging to `main` or applying production migrations.

## Phase 2 direction

Design shared division/service type contracts, tenancy-aware jobs, quote/offer/assignment lifecycle, capability matching and events **against the actual Supabase schema**. Preserve specialized freight, food-order and passenger-trip state machines instead of forcing all of them into a generic load status.

Class C marketplaces should be designed after validating legal/commercial eligibility, service areas, financial provider and privacy boundaries. Hazardous/refrigerated/oversized freight requires capability and regulatory gates.

## QA note

No claim of full build, CI or browser QA is made until runs are observed. This commit is intentionally a non-production Phase 1 implementation.
