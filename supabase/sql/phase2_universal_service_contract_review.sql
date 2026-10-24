-- ANDERTRACK UNIVERSAL OS PHASE 2: REVIEW ONLY — DO NOT APPLY
-- This file is NOT under supabase/migrations and is intentionally not deployed.
-- Current at_assignments and FIFO RPCs are NOT modified.
-- Preconditions: staging-only at_organizations, at_organization_members,
-- at_driver_profiles tables exist with their original constraints/RLS.
-- Before implementation: resolve service-owned source FKs, audited RPC writes,
-- eligibility/permits lifecycle, and run staging RLS/concurrency tests.

create table public.at_universal_job_registry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.at_organizations(id) on delete cascade,
  service_type text not null check (service_type in (
    'freight_3pl','hotshot','warehouse_transfer',
    'local_courier','food_delivery','passenger_ride'
  )),
  source_kind text not null,
  source_id uuid not null,
  status text not null,
  requirements jsonb not null default '{}'::jsonb
    check (jsonb_typeof(requirements)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,service_type,source_id),
  check (
    (service_type in ('freight_3pl','hotshot') and source_kind='freight_load') or
    (service_type='warehouse_transfer' and source_kind='warehouse_task') or
    (service_type='local_courier' and source_kind='courier_order') or
    (service_type='food_delivery' and source_kind='food_order') or
    (service_type='passenger_ride' and source_kind='passenger_trip')
  ),
  check (
    (service_type in ('freight_3pl','hotshot') and status in
      ('draft','ready','offered','assigned','at_pickup','loaded','in_transit','delivered','completed','cancelled')) or
    (service_type='warehouse_transfer' and status in
      ('draft','ready','assigned','in_progress','completed','cancelled')) or
    (service_type='local_courier' and status in
      ('requested','ready','offered','assigned','at_pickup','picked_up','in_transit','delivered','completed','cancelled')) or
    (service_type='food_delivery' and status in
      ('placed','merchant_accepted','preparing','ready','offered','courier_assigned','picked_up','delivering','delivered','cancelled','rejected')) or
    (service_type='passenger_ride' and status in
      ('requested','quoted','ready','offered','driver_assigned','arriving','in_progress','completed','cancelled'))
  )
);
create index at_universal_job_org_service_state_idx
  on public.at_universal_job_registry(organization_id,service_type,status,created_at desc);

create table public.at_service_driver_authorizations (
  organization_id uuid not null
    references public.at_organizations(id) on delete cascade,
  driver_user_id uuid not null,
  service_type text not null check (service_type in (
    'freight_3pl','hotshot','warehouse_transfer',
    'local_courier','food_delivery','passenger_ride'
  )),
  status text not null default 'pending'
    check (status in ('pending','approved','held','revoked')),
  approved_capabilities text[] not null default '{}',
  operational_permits_verified boolean not null default false,
  checked_at timestamptz,
  primary key (organization_id,driver_user_id,service_type),
  foreign key (organization_id,driver_user_id)
    references public.at_driver_profiles(organization_id,user_id)
);

-- No public browser writes. SECURITY INVOKER selects are RLS-scoped.
alter table public.at_universal_job_registry enable row level security;
alter table public.at_service_driver_authorizations enable row level security;
revoke all on public.at_universal_job_registry from public,anon,authenticated;
revoke all on public.at_service_driver_authorizations from public,anon,authenticated;
grant select on public.at_universal_job_registry to authenticated;
grant select on public.at_service_driver_authorizations to authenticated;

create policy at_universal_jobs_planner_read
  on public.at_universal_job_registry
  for select to authenticated
  using (exists(
    select 1 from public.at_organization_members m
    where m.organization_id=at_universal_job_registry.organization_id
      and m.user_id=(select auth.uid())
      and m.role in ('admin','dispatcher')
  ));

create policy at_service_auth_planner_read
  on public.at_service_driver_authorizations
  for select to authenticated
  using (exists(
    select 1 from public.at_organization_members m
    where m.organization_id=at_service_driver_authorizations.organization_id
      and m.user_id=(select auth.uid())
      and m.role in ('admin','dispatcher')
  ));

-- IMPORTANT UNRESOLVED ITEMS BEFORE EXECUTION:
-- 1. Enforce source_id foreign keys through service-specific tables/triggers.
-- 2. Build immutable, audited, authenticated server/RPC operations for inserts,
--    transitions and approvals; there are intentionally no INSERT/UPDATE grants.
-- 3. Make server-side qualification and active-vehicle interlocks authoritative.
-- 4. Implement RLS tests for cross-org, driver, merchant and customer boundaries.
-- 5. Do not use this SQL in production or claim existing at_* data migrated.
