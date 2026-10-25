-- Preserve equipment requirements for Class A/B/C collection work.
alter table public.at_assignments add column required_license_class text check(required_license_class in ('A','B','C'));
alter table public.at_assignments add column created_by uuid default auth.uid() references auth.users(id);
create index at_assignment_created_by_idx on public.at_assignments(created_by);
create function at_private.create_service_task(p_organization_id uuid,p_service_id text,p_reference text,p_customer text,p_detail text,p_pickup text,p_destination text,p_estimated_miles numeric,p_required_license_class text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if p_required_license_class is null or p_required_license_class not in ('A','B','C')
    or (p_service_id in ('freight','otr') and p_required_license_class='C')
    or (p_service_id in ('courier','food','rideshare') and p_required_license_class<>'C')
  then raise exception 'Choose the correct equipment license class for this service' using errcode='22023';end if;
  result:=at_private.create_service_assignment(p_organization_id,p_service_id,p_reference,p_customer,p_detail,p_pickup,p_destination,p_estimated_miles);
  update public.at_assignments set required_license_class=p_required_license_class,division=case when p_required_license_class='C' then 'Class C' else 'CDL' end where id=result;
  return result;
end $$;
create function public.at_create_service_task(p_organization_id uuid,p_service_id text,p_reference text,p_customer text,p_detail text,p_pickup text,p_destination text,p_estimated_miles numeric,p_required_license_class text)
returns uuid language sql security invoker set search_path='' as $$select at_private.create_service_task(p_organization_id,p_service_id,p_reference,p_customer,p_detail,p_pickup,p_destination,p_estimated_miles,p_required_license_class)$$;
revoke all on function at_private.create_service_task(uuid,text,text,text,text,text,text,numeric,text) from public,anon;
revoke all on function public.at_create_service_task(uuid,text,text,text,text,text,text,numeric,text) from public,anon;
grant execute on function at_private.create_service_task(uuid,text,text,text,text,text,text,numeric,text) to authenticated;
grant execute on function public.at_create_service_task(uuid,text,text,text,text,text,text,numeric,text) to authenticated;
create or replace function at_private.guard_service_offer() returns trigger language plpgsql security definer set search_path='' as $$
declare requested_service text; first_driver uuid;
begin
  if new.service_id is not null and new.status in ('offered','assigned','accepted','at_pickup','picked_up','in_transit') and
    (new.status is distinct from old.status or new.driver_user_id is distinct from old.driver_user_id) then
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,923841));
    if new.required_license_class is not null and not exists(select 1 from public.at_vehicles where id=new.vehicle_id and organization_id=new.organization_id and required_license_class=new.required_license_class) then raise exception 'Vehicle class does not meet this task equipment requirement'; end if;
    if not exists(select 1 from public.at_driver_service_access where organization_id=new.organization_id and driver_user_id=new.driver_user_id and service_id=new.service_id and enabled)
    then raise exception 'Driver is not approved for this service'; end if;
    if not exists(select 1 from public.at_live_driver_locations where organization_id=new.organization_id and driver_user_id=new.driver_user_id and online and sharing and last_ping_at>clock_timestamp()-interval '60 seconds')
    then raise exception 'Driver location is offline or stale'; end if;
    if new.status in ('offered','assigned') then
    select q.driver_user_id,q.service_id into first_driver,requested_service from public.at_dispatch_requests q
      where q.organization_id=new.organization_id and q.status='queued' order by q.queue_number limit 1;
    if first_driver is not null and (first_driver<>new.driver_user_id or (requested_service is not null and requested_service<>new.service_id))
    then raise exception 'Offer must match the oldest queued driver and requested service'; end if;
    end if;
  end if;
  return new;
end $$;
