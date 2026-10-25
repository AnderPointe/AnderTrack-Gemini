-- Apply only to ofyfausfhinwgrfmapgc (Andertrack Staging).
-- Additive test workspace. No operational assignments, payments, or eligibility changes.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.at_driver_test_preferences (
  organization_id uuid not null,
  user_id uuid not null,
  service_id text not null check (service_id in ('freight','otr','courier','food','rideshare','waste')),
  online boolean not null default false,
  primary key (organization_id,user_id),
  foreign key (organization_id,user_id) references public.at_driver_profiles(organization_id,user_id) on delete cascade
);
create index at_driver_test_preferences_user_idx on public.at_driver_test_preferences(user_id);
alter table public.at_driver_test_preferences enable row level security;
revoke all on public.at_driver_test_preferences from anon,authenticated;
grant select,insert,update on public.at_driver_test_preferences to authenticated;
create policy driver_test_preferences_select on public.at_driver_test_preferences for select to authenticated
  using (user_id=(select auth.uid()) and exists (select 1 from public.at_organization_members m where m.organization_id=at_driver_test_preferences.organization_id and m.user_id=(select auth.uid())));
create policy driver_test_preferences_insert on public.at_driver_test_preferences for insert to authenticated
  with check (user_id=(select auth.uid()) and exists (select 1 from public.at_organization_members m where m.organization_id=at_driver_test_preferences.organization_id and m.user_id=(select auth.uid())));
create policy driver_test_preferences_update on public.at_driver_test_preferences for update to authenticated
  using (user_id=(select auth.uid()) and exists (select 1 from public.at_organization_members m where m.organization_id=at_driver_test_preferences.organization_id and m.user_id=(select auth.uid())))
  with check (user_id=(select auth.uid()) and exists (select 1 from public.at_organization_members m where m.organization_id=at_driver_test_preferences.organization_id and m.user_id=(select auth.uid())));

create table public.at_driver_test_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  driver_user_id uuid not null,
  service_id text not null check (service_id in ('freight','otr','courier','food','rideshare','waste')),
  reference text not null check (reference like 'TEST-%'),
  pickup text not null,
  destination text not null,
  detail text not null,
  estimated_cents integer not null check (estimated_cents >= 0),
  status text not null default 'offered' check (status in ('offered','accepted','at_pickup','in_transit','completed')),
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id,driver_user_id,reference),
  foreign key (organization_id,driver_user_id) references public.at_driver_profiles(organization_id,user_id) on delete cascade
);
create index at_driver_test_jobs_driver_idx on public.at_driver_test_jobs(driver_user_id,organization_id);
alter table public.at_driver_test_jobs enable row level security;
revoke all on public.at_driver_test_jobs from anon,authenticated;
grant select on public.at_driver_test_jobs to authenticated;
grant update(status) on public.at_driver_test_jobs to authenticated;
create policy driver_test_jobs_select on public.at_driver_test_jobs for select to authenticated
  using (driver_user_id=(select auth.uid()) and exists (select 1 from public.at_organization_members m where m.organization_id=at_driver_test_jobs.organization_id and m.user_id=(select auth.uid())));
create policy driver_test_jobs_update on public.at_driver_test_jobs for update to authenticated
  using (driver_user_id=(select auth.uid()) and exists (select 1 from public.at_organization_members m where m.organization_id=at_driver_test_jobs.organization_id and m.user_id=(select auth.uid())))
  with check (driver_user_id=(select auth.uid()) and exists (select 1 from public.at_organization_members m where m.organization_id=at_driver_test_jobs.organization_id and m.user_id=(select auth.uid())));

create table public.at_driver_test_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.at_driver_test_jobs(id) on delete cascade,
  previous_status text not null,
  next_status text not null,
  revision integer not null,
  actor_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (job_id,revision)
);
create index at_driver_test_job_events_actor_idx on public.at_driver_test_job_events(actor_user_id);
alter table public.at_driver_test_job_events enable row level security;
revoke all on public.at_driver_test_job_events from anon,authenticated;
grant select on public.at_driver_test_job_events to authenticated;
create policy driver_test_job_events_select on public.at_driver_test_job_events for select to authenticated
  using (actor_user_id=(select auth.uid()) and exists (select 1 from public.at_driver_test_jobs j where j.id=at_driver_test_job_events.job_id));

create function private.guard_driver_test_job() returns trigger language plpgsql security invoker set search_path='' as $$
declare expected text;
begin
  expected := case old.status when 'offered' then 'accepted' when 'accepted' then 'at_pickup' when 'at_pickup' then 'in_transit' when 'in_transit' then 'completed' else null end;
  if expected is null or new.status<>expected then
    raise exception 'Invalid test job transition: % to %',old.status,new.status using errcode='23514';
  end if;
  new.revision := old.revision+1;
  new.updated_at := now();
  return new;
end; $$;
revoke all on function private.guard_driver_test_job() from public,anon,authenticated;
create trigger guard_driver_test_job before update on public.at_driver_test_jobs for each row execute function private.guard_driver_test_job();

-- Trigger-only audit writer. No direct execute or audit INSERT privilege for clients.
create function private.audit_driver_test_job() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid()<>new.driver_user_id then
    raise exception 'A driver session is required for test progress' using errcode='42501';
  end if;
  insert into public.at_driver_test_job_events(job_id,previous_status,next_status,revision,actor_user_id)
  values(new.id,old.status,new.status,new.revision,auth.uid());
  return new;
end; $$;
revoke all on function private.audit_driver_test_job() from public,anon,authenticated;
create trigger audit_driver_test_job after update on public.at_driver_test_jobs for each row execute function private.audit_driver_test_job();
comment on table public.at_driver_test_jobs is 'Synthetic test jobs only. Not operational dispatch, service approval, or payable earnings.';
