# Universal Logistics OS — Phase 2: shared dispatch and data contracts

## Implementation scope

Branch: `feature/universal-os-phase2-dispatch-contracts` (stacked on Phase 1 migration branch). No merge or deployment.

This phase **builds an additive, read-only application contract** that can represent six service types without conflating state machines or accidentally activating an unfinished marketplace.

### Implemented
- `src/lib/universal-jobs.js`: six explicit service types with source type, Class C division placement, and service-specific statuses; strict normalization and scope checking.
- `src/lib/universal-eligibility.js`: conservative, advisory candidate screening requiring matching company, approved service, qualification, vehicle capacity, checked safety and no active assignment collisions.
- `src/features/live/UniversalDispatchFoundation.jsx`: read-only shared dispatch foundation visible on the existing Universal Command Center. Legacy CDL / Class C records are **not assumed** to be hotshot / food / rides.
- `src/features/live/universal-dispatch.css`: responsive dashboard styling.
- `src/features/live/OpsCommandCenter.jsx`: integrated above existing operational metrics and real fleet map.
- `tests/universal-dispatch.test.mjs`: contract, tenant scope, lifecycle and fail-closed eligibility regression tests.
- `supabase/sql/phase2_universal_service_contract_review.sql`: **review-only** RLS/schema proposal, intentionally NOT an applied migration.

## Compatibility with existing AnderTrack code

- `at_assignments` has only `division: 'CDL' | 'Class C'`. A service-type inference from `commodity`, vehicle type, driver license, or legacy division is **unsafe**. The new common model leaves those records unclassified until source-of-truth records exist.
- `dispatch-planner.js` remains the existing deterministic freight/queue advisor. Its FIFO policy is authoritative only when enforced by RPC.
- `AssignmentActions.jsx` and `DispatchRequestQueue.jsx` remain backed by existing controlled Supabase RPC operations.
- `fleet-safety-interlocks.js` is reused to fail closed when a vehicle safety snapshot is missing, incomplete, held or stale.
- No new route, payment, food order, passenger ride, dispatch offer or write transaction is enabled.
- Existing `at_organizations`, `at_organization_members`, `at_driver_profiles`, `at_vehicles` and `at_assignments` are not overwritten.

## Supported common record shape

```js
{
  id: 'job-uuid',
  organization_id: 'organization-uuid',
  service_type: 'food_delivery',
  source_kind: 'food_order',
  source_id: 'food-order-uuid',
  status: 'ready',
  requirements: {
    required_capabilities: ['insulated_bag'],
    weight_lbs: null,
    passenger_count: null,
    regulated_commodity: false,
  },
}
```

This record is a **future interface**; it does not indicate the database table or a food marketplace currently exists. Client normalization is not authentication or authorization.

## Safety and boundaries

1. The shared matcher is **advisory only**, never an authorization to assign a driver. Real offers/claims require server transactions with tenant identity, FIFO handling, explicit vehicle/driver locks, and up-to-date safety conditions.
2. Missing verification returns `eligible:false`. A successful local screening must never skip protected RPCs.
3. Food delivery and passenger services require their **own approval, insurance, applicable permits and operational controls** before activation. Placeholder approval fields do not substitute for regulatory validation.
4. A passenger count requires a verified seating capacity, not generic cargo payload.
5. All commodity categories may be represented, but hazmat, oversize, temperature-controlled, medical and other regulated loads demand additional verified capabilities, qualification, and legal checks.
6. The proposed SQL is not executable production guidance. Before any staging application, complete source FK integrity, role-specific RLS, and security-reviewed RPCs.

## Architecture evolution

```text
Universal Command Center
  ├─ 3PL freight + hotshot       -> freight_load service-specific records
  ├─ Warehouse transfer         -> warehouse_task service-specific records
  └─ Class C Local Services
       ├─ Local courier          -> courier_order service-specific records
       ├─ Food delivery          -> food_order service-specific records
       └─ Passenger ride         -> passenger_trip service-specific records

  shared: organizations, drivers, vehicles, qualifications,
          telemetry, job registry, offers, audited status events

  protected database/RPC transactions are the only dispatch writers.
```

## QA/release gates

- [ ] Node regression suite passes, including Phase 1 navigation tests.
- [ ] Vite production build passes.
- [ ] Authenticated staging UI verifies only company-scoped data in common foundation.
- [ ] Staging Postgres advisor and actual RLS tests run before any schema changes.
- [ ] Offer/claim concurrency, FIFO and OOS safety trigger confirmed with server-side tests.
- [ ] Responsive Command Center reviewed on desktop/mobile.
- [ ] No production Vercel, Supabase, repository merge, or domain change.
- [ ] Phase 1 PR reviewed before dependent Phase 2 integration.

## Next phase

Phase 3: implement service-specific data sources and validated, server-authorized assignment adapters in staging, beginning with Class C local courier. Food and passenger must remain deactivated until their own merchant/rider/payment/rules and safety workflows are complete.
