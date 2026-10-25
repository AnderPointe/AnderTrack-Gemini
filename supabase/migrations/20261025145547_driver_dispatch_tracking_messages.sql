-- Additive communications pilot for Andertrack Staging (ofyfausfhinwgrfmapgc).
-- Existing dispatch safety, license, equipment, FIFO and POD rules are preserved.
alter table public.at_assignments add column service_id text
  check(service_id in ('freight','otr','courier','food','rideshare','waste'));
alter table public.at_dispatch_requests add column service_id text
  check(service_id in ('freight','otr','courier','food','rideshare','waste'));

create table public.at_driver_service_access (
  organization_id uuid not null,
  driver_user_id uuid not null,
  service_id text not null check(service_id in ('freight','otr','courier','food','rideshare','waste')),
  enabled boolean not null default false,
  reviewed_by uuid not null references auth.users(id),
  review_note text not null check(length(trim(review_note)) between 10 and 1000),
  reviewed_at timestamptz not null default now(),
  primary key(organization_id,driver_user_id,service_id),
  foreign key(organization_id,driver_user_id) references public.at_driver_profiles(organization_id,user_id)
);
create index at_service_access_driver_idx on public.at_driver_service_access(driver_user_id);
create index at_service_access_reviewer_idx on public.at_driver_service_access(reviewed_by);
alter table public.at_driver_service_access enable row level security;
revoke all on public.at_driver_service_access from anon,authenticated;
grant select on public.at_driver_service_access to authenticated;
create policy service_access_read on public.at_driver_service_access for select to authenticated using(
  exists(select 1 from public.at_organization_members m where m.organization_id=at_driver_service_access.organization_id
  and m.user_id=(select auth.uid()) and (m.role in ('admin','dispatcher') or at_driver_service_access.driver_user_id=(select auth.uid())))
);

create table public.at_live_driver_locations (
  organization_id uuid not null,
  driver_user_id uuid not null,
  latitude double precision check(latitude between -90 and 90),
  longitude double precision check(longitude between -180 and 180),
  accuracy_meters double precision check(accuracy_meters>=0 and accuracy_meters<=1000),
  heading double precision check(heading>=0 and heading<360),
  speed_mph double precision check(speed_mph>=0 and speed_mph<=200),
  tracking_session_id uuid,
  sharing boolean not null default false,
  online boolean not null default false,
  last_ping_at timestamptz,
  primary key(organization_id,driver_user_id),
  foreign key(organization_id,driver_user_id) references public.at_driver_profiles(organization_id,user_id),
  check(not online or (sharing and latitude is not null and longitude is not null and last_ping_at is not null))
);
create index at_live_locations_driver_idx on public.at_live_driver_locations(driver_user_id);
alter table public.at_live_driver_locations enable row level security;
revoke all on public.at_live_driver_locations from anon,authenticated;
grant select on public.at_live_driver_locations to authenticated;
create policy live_locations_participants on public.at_live_driver_locations for select to authenticated using(
  exists(select 1 from public.at_organization_members m where m.organization_id=at_live_driver_locations.organization_id
  and m.user_id=(select auth.uid()) and (m.role in ('admin','dispatcher') or at_live_driver_locations.driver_user_id=(select auth.uid())))
);

create table public.at_dispatch_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  driver_user_id uuid not null,
  sender_user_id uuid not null default auth.uid() references auth.users(id),
  body text not null check(length(trim(body)) between 1 and 2000),
  client_nonce uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(sender_user_id,client_nonce),
  foreign key(organization_id,driver_user_id) references public.at_driver_profiles(organization_id,user_id)
);
create index at_dispatch_messages_thread_idx on public.at_dispatch_messages(organization_id,driver_user_id,created_at desc);
create index at_dispatch_messages_driver_idx on public.at_dispatch_messages(driver_user_id);
alter table public.at_dispatch_messages enable row level security;
revoke all on public.at_dispatch_messages from anon,authenticated;
grant select on public.at_dispatch_messages to authenticated;
grant insert(organization_id,driver_user_id,body,client_nonce) on public.at_dispatch_messages to authenticated;
create policy dispatch_messages_read on public.at_dispatch_messages for select to authenticated using(
  exists(select 1 from public.at_organization_members m where m.organization_id=at_dispatch_messages.organization_id
  and m.user_id=(select auth.uid()) and (m.role in ('admin','dispatcher') or (m.role='driver' and at_dispatch_messages.driver_user_id=(select auth.uid()))))
);
create policy dispatch_messages_send on public.at_dispatch_messages for insert to authenticated with check(
  sender_user_id=(select auth.uid()) and exists(select 1 from public.at_organization_members m
  where m.organization_id=at_dispatch_messages.organization_id and m.user_id=(select auth.uid())
  and (m.role in ('admin','dispatcher') or (m.role='driver' and at_dispatch_messages.driver_user_id=(select auth.uid()))))
);

create function at_private.begin_driver_tracking(p_organization_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); token uuid:=gen_random_uuid();
begin
  if actor is null or not exists(select 1 from public.at_organization_members m join public.at_driver_profiles d
    on d.organization_id=m.organization_id and d.user_id=m.user_id where m.organization_id=p_organization_id and m.user_id=actor and m.role='driver')
  then raise exception 'Driver membership required' using errcode='42501'; end if;
  insert into public.at_live_driver_locations(organization_id,driver_user_id,tracking_session_id,sharing)
  values(p_organization_id,actor,token,true) on conflict(organization_id,driver_user_id) do update
    set tracking_session_id=token,sharing=true,online=false,latitude=null,longitude=null,accuracy_meters=null,heading=null,speed_mph=null,last_ping_at=null;
  return token;
end $$;

create function at_private.publish_driver_location(p_organization_id uuid,p_session_id uuid,p_latitude double precision,p_longitude double precision,
  p_accuracy double precision,p_captured_at timestamptz,p_heading double precision default null,p_speed_mph double precision default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not exists(select 1 from public.at_organization_members m where m.organization_id=p_organization_id and m.user_id=actor and m.role='driver')
  then raise exception 'Driver membership required' using errcode='42501'; end if;
  if p_latitude is null or p_longitude is null or p_accuracy is null or not(p_latitude between -90 and 90)
    or not(p_longitude between -180 and 180) or not(p_accuracy between 0 and 1000)
    or p_captured_at is null or p_captured_at<clock_timestamp()-interval '60 seconds' or p_captured_at>clock_timestamp()+interval '5 seconds'
  then raise exception 'A fresh valid location with accuracy within 1000 meters is required' using errcode='22023'; end if;
  update public.at_live_driver_locations set latitude=p_latitude,longitude=p_longitude,accuracy_meters=p_accuracy,heading=p_heading,
    speed_mph=p_speed_mph,last_ping_at=clock_timestamp()
  where organization_id=p_organization_id and driver_user_id=actor and tracking_session_id=p_session_id and sharing;
  if not found then raise exception 'Tracking session ended or replaced' using errcode='42501'; end if;
  return jsonb_build_object('received',true);
end $$;

create function at_private.set_driver_online(p_organization_id uuid,p_online boolean,p_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=actor and role='driver')
  then raise exception 'Driver membership required' using errcode='42501'; end if;
  if p_online is null then raise exception 'Online state is required'; end if;
  perform 1 from public.at_live_driver_locations where organization_id=p_organization_id and driver_user_id=actor and tracking_session_id=p_session_id for update;
  if not found then raise exception 'Tracking session ended or replaced' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,923841));
  if p_online and not exists(select 1 from public.at_live_driver_locations where organization_id=p_organization_id
    and driver_user_id=actor and sharing and last_ping_at>clock_timestamp()-interval '60 seconds')
  then raise exception 'Share a fresh location before going online' using errcode='23514'; end if;
  if not p_online and exists(select 1 from public.at_dispatch_requests where organization_id=p_organization_id and driver_user_id=actor and status='queued')
  then perform at_private.cancel_dispatch(p_organization_id); end if;
  update public.at_live_driver_locations set online=p_online,sharing=p_online,tracking_session_id=case when p_online then tracking_session_id else null end,
    latitude=case when p_online then latitude else null end,longitude=case when p_online then longitude else null end,
    heading=case when p_online then heading else null end,speed_mph=case when p_online then speed_mph else null end,
    accuracy_meters=case when p_online then accuracy_meters else null end
  where organization_id=p_organization_id and driver_user_id=actor;
  update public.at_driver_profiles set availability=case when p_online then 'available' else 'offline' end
  where organization_id=p_organization_id and user_id=actor and availability<>'busy';
  return jsonb_build_object('online',p_online);
end $$;

create function at_private.driver_queue_snapshot(p_organization_id uuid)
returns table(id uuid,queue_number text,driver_user_id uuid,display_name text,service_id text,requested_at timestamptz,queue_position bigint)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=auth.uid())
  then raise exception 'Organization membership required' using errcode='42501'; end if;
  return query select q.id,q.queue_number::text,q.driver_user_id,d.display_name,q.service_id,q.requested_at,
    row_number() over(order by q.queue_number) from public.at_dispatch_requests q
    join public.at_driver_profiles d on d.organization_id=q.organization_id and d.user_id=q.driver_user_id
    where q.organization_id=p_organization_id and q.status='queued' order by q.queue_number;
end $$;

create function at_private.join_driver_queue(p_organization_id uuid,p_service_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.at_live_driver_locations where organization_id=p_organization_id and driver_user_id=auth.uid()
    and sharing and online and last_ping_at>clock_timestamp()-interval '60 seconds')
  then raise exception 'Go online with location sharing before joining the queue' using errcode='23514'; end if;
  if not exists(select 1 from public.at_driver_service_access where organization_id=p_organization_id and driver_user_id=auth.uid()
    and service_id=p_service_id and enabled) then raise exception 'Service approval required' using errcode='42501'; end if;
  result:=at_private.request_dispatch(p_organization_id);
  update public.at_dispatch_requests set service_id=p_service_id where id=(result->>'id')::uuid;
  return result;
end $$;

create function at_private.create_service_assignment(p_organization_id uuid,p_service_id text,p_reference text,p_customer text,p_detail text,
  p_pickup text,p_destination text,p_estimated_miles numeric default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=auth.uid() and role in ('admin','dispatcher'))
  then raise exception 'Dispatcher permission required' using errcode='42501'; end if;
  if p_service_id is null or p_service_id not in ('freight','otr','courier','food','rideshare','waste') then raise exception 'Choose a supported service'; end if;
  if p_reference is null or length(trim(p_reference)) not between 3 and 80 or p_customer is null or length(trim(p_customer)) not between 2 and 160
    or p_detail is null or length(trim(p_detail)) not between 2 and 1000 or p_pickup is null or length(trim(p_pickup)) not between 3 and 300
    or p_destination is null or length(trim(p_destination)) not between 3 and 300 or (p_estimated_miles is not null and not(p_estimated_miles between 0 and 10000))
  then raise exception 'Complete valid task, customer and route details' using errcode='22023'; end if;
  insert into public.at_assignments(organization_id,service_id,reference,division,customer_name,commodity,pickup_address,dropoff_address,estimated_miles)
  values(p_organization_id,p_service_id,trim(p_reference),case when p_service_id in ('freight','otr') then 'CDL' else 'Class C' end,
    trim(p_customer),trim(p_detail),trim(p_pickup),trim(p_destination),p_estimated_miles) returning id into result;
  return result;
end $$;

create function at_private.set_driver_service_access(p_organization_id uuid,p_driver_user_id uuid,p_service_id text,p_enabled boolean,p_note text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=auth.uid() and role in ('admin','dispatcher'))
  then raise exception 'Dispatcher permission required' using errcode='42501'; end if;
  if p_note is null or length(trim(p_note)) not between 10 and 1000 then raise exception 'Record the qualification review before changing access'; end if;
  if p_enabled and not exists(select 1 from public.at_driver_profiles where organization_id=p_organization_id and user_id=p_driver_user_id and license_verified) then raise exception 'Verify the driver license before approving service access'; end if;
  insert into public.at_driver_service_access(organization_id,driver_user_id,service_id,enabled,reviewed_by,review_note)
  values(p_organization_id,p_driver_user_id,p_service_id,p_enabled,auth.uid(),trim(p_note))
  on conflict(organization_id,driver_user_id,service_id) do update set enabled=excluded.enabled,reviewed_by=auth.uid(),review_note=excluded.review_note,reviewed_at=clock_timestamp();
end $$;

-- A service-specific offer cannot bypass approval, location sharing or queue priority through an older offer endpoint.
create function at_private.guard_service_offer() returns trigger language plpgsql security definer set search_path='' as $$
declare requested_service text; first_driver uuid;
begin
  if new.service_id is not null and new.status in ('offered','assigned','accepted','at_pickup','picked_up','in_transit') and
    (new.status is distinct from old.status or new.driver_user_id is distinct from old.driver_user_id) then
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text,923841));
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
revoke all on function at_private.guard_service_offer() from public,anon,authenticated;
create trigger guard_service_offer before update on public.at_assignments for each row execute function at_private.guard_service_offer();

create function public.at_begin_driver_tracking(p_organization_id uuid)
returns uuid language sql security invoker set search_path='' as $$select at_private.begin_driver_tracking(p_organization_id)$$;
create function public.at_publish_driver_location(p_organization_id uuid,p_session_id uuid,p_latitude double precision,p_longitude double precision,p_accuracy double precision,p_captured_at timestamptz,p_heading double precision default null,p_speed_mph double precision default null)
returns jsonb language sql security invoker set search_path='' as $$select at_private.publish_driver_location(p_organization_id,p_session_id,p_latitude,p_longitude,p_accuracy,p_captured_at,p_heading,p_speed_mph)$$;
create function public.at_set_driver_online(p_organization_id uuid,p_online boolean,p_session_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select at_private.set_driver_online(p_organization_id,p_online,p_session_id)$$;
create function public.at_driver_queue_snapshot(p_organization_id uuid)
returns table(id uuid,queue_number text,driver_user_id uuid,display_name text,service_id text,requested_at timestamptz,queue_position bigint)
language sql security invoker set search_path='' as $$select * from at_private.driver_queue_snapshot(p_organization_id)$$;
create function public.at_join_driver_queue(p_organization_id uuid,p_service_id text)
returns jsonb language sql security invoker set search_path='' as $$select at_private.join_driver_queue(p_organization_id,p_service_id)$$;
create function public.at_create_service_assignment(p_organization_id uuid,p_service_id text,p_reference text,p_customer text,p_detail text,p_pickup text,p_destination text,p_estimated_miles numeric default null)
returns uuid language sql security invoker set search_path='' as $$select at_private.create_service_assignment(p_organization_id,p_service_id,p_reference,p_customer,p_detail,p_pickup,p_destination,p_estimated_miles)$$;
create function public.at_set_driver_service_access(p_organization_id uuid,p_driver_user_id uuid,p_service_id text,p_enabled boolean,p_note text)
returns void language sql security invoker set search_path='' as $$select at_private.set_driver_service_access(p_organization_id,p_driver_user_id,p_service_id,p_enabled,p_note)$$;

do $$declare r record; begin
  for r in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='at_private' and p.proname in ('begin_driver_tracking','publish_driver_location','set_driver_online','driver_queue_snapshot','join_driver_queue','create_service_assignment','set_driver_service_access'))
     or (n.nspname='public' and p.proname in ('at_begin_driver_tracking','at_publish_driver_location','at_set_driver_online','at_driver_queue_snapshot','at_join_driver_queue','at_create_service_assignment','at_set_driver_service_access'))
  loop execute format('revoke all on function %I.%I(%s) from public,anon',r.nspname,r.proname,r.args);
    execute format('grant execute on function %I.%I(%s) to authenticated',r.nspname,r.proname,r.args); end loop;
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.at_dispatch_messages,public.at_live_driver_locations,public.at_driver_service_access;
  end if;
end $$;
