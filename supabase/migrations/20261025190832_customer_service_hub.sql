-- Customer shipment pilot. Applied only to staging. All prices are integer USD cents.
create table public.at_service_hub_policies(
 organization_id uuid primary key references public.at_organizations(id),
 display_name text not null check(length(btrim(display_name)) between 2 and 160),
 enabled boolean not null default false,
 base_cents integer not null default 2500 check(base_cents between 0 and 100000),
 mile_cents integer not null default 200 check(mile_cents between 1 and 10000),
 pallet_cents integer not null default 1000 check(pallet_cents between 0 and 100000),
 weight_1000_cents integer not null default 500 check(weight_1000_cents between 0 and 100000),
 minimum_cents integer not null default 5000 check(minimum_cents between 1 and 10000000),
 driver_share_bps integer not null default 8000 check(driver_share_bps between 1000 and 10000),
 driver_floor_cents integer not null default 4000 check(driver_floor_cents between 0 and minimum_cents),
 max_payload_lbs integer not null default 44000 check(max_payload_lbs between 1 and 100000),
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.at_customer_requests(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.at_organizations(id),
 customer_user_id uuid not null references auth.users(id),client_nonce uuid not null,
 service_id text not null check(service_id in ('freight','otr','courier','food','rideshare','waste')),
 pickup_address text not null check(length(btrim(pickup_address)) between 3 and 300),
 dropoff_address text not null check(length(btrim(dropoff_address)) between 3 and 300),
 description text not null check(length(btrim(description)) between 2 and 1000),
 pallets integer not null check(pallets between 0 and 26),payload_lbs integer not null check(payload_lbs between 1 and 100000),
 requested_miles numeric(10,2) not null check(requested_miles between 1 and 10000), reviewed_miles numeric(10,2),
 window_start timestamptz not null,window_end timestamptz not null check(window_end>window_start),
 urgency text not null check(urgency in ('standard','priority','express')),
 status text not null default 'submitted' check(status in ('submitted','quote_ready','booked','cancelled')),
 quote jsonb not null,quote_expires_at timestamptz,reviewed_by uuid references auth.users(id),
 assignment_id uuid unique references public.at_assignments(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(customer_user_id,client_nonce)
);
create index customer_requests_customer_idx on public.at_customer_requests(customer_user_id,created_at desc);
create index customer_requests_org_idx on public.at_customer_requests(organization_id,status,created_at desc);
create table public.at_shipment_messages(
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.at_customer_requests(id),
 sender_user_id uuid not null default auth.uid() references auth.users(id),
 body text not null check(length(btrim(body)) between 1 and 2000),client_nonce uuid not null,
 created_at timestamptz not null default now(),unique(sender_user_id,client_nonce)
);
create index shipment_messages_thread_idx on public.at_shipment_messages(request_id,created_at);

create function at_private.can_read_customer_request(p_request uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.at_customer_requests r left join public.at_assignments a on a.id=r.assignment_id
 where r.id=p_request and (r.customer_user_id=auth.uid() or (a.driver_user_id=auth.uid() and exists(select 1 from public.at_organization_members dm where dm.organization_id=r.organization_id and dm.user_id=auth.uid() and dm.role='driver')) or exists(select 1 from public.at_organization_members m where m.organization_id=r.organization_id and m.user_id=auth.uid() and m.role in ('admin','dispatcher'))))
$$;
revoke all on function at_private.can_read_customer_request(uuid) from public,anon;grant execute on function at_private.can_read_customer_request(uuid) to authenticated;
alter table public.at_service_hub_policies enable row level security;
alter table public.at_customer_requests enable row level security;
alter table public.at_shipment_messages enable row level security;
revoke all on public.at_service_hub_policies,public.at_customer_requests,public.at_shipment_messages from anon,authenticated;
grant select on public.at_service_hub_policies,public.at_customer_requests,public.at_shipment_messages to authenticated;
grant insert(request_id,body,client_nonce) on public.at_shipment_messages to authenticated;
create policy hub_policy_read on public.at_service_hub_policies for select to authenticated using(enabled or exists(select 1 from public.at_organization_members m where m.organization_id=at_service_hub_policies.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','dispatcher')));
create policy customer_request_read on public.at_customer_requests for select to authenticated using(at_private.can_read_customer_request(id));
create policy shipment_message_read on public.at_shipment_messages for select to authenticated using(at_private.can_read_customer_request(request_id));
create policy shipment_message_insert on public.at_shipment_messages for insert to authenticated with check(sender_user_id=(select auth.uid()) and at_private.can_read_customer_request(request_id));

create function at_private.hub_quote(p public.at_service_hub_policies,miles numeric,pallets integer,payload integer,urgency text) returns jsonb language plpgsql immutable set search_path='' as $$
declare distance_cost bigint:=ceil(miles*p.mile_cents); pallet_cost bigint:=pallets*p.pallet_cents;weight_cost bigint:=ceil(payload::numeric/1000)*p.weight_1000_cents; subtotal bigint; rush bigint; amount bigint;driver_amount bigint;
begin
 subtotal:=p.base_cents+distance_cost+pallet_cost+weight_cost;
 rush:=ceil(subtotal*case urgency when 'priority' then 0.25 when 'express' then 0.50 else 0 end);
 amount:=greatest(p.minimum_cents,subtotal+rush);driver_amount:=greatest(p.driver_floor_cents,floor(amount*p.driver_share_bps::numeric/10000));
 return jsonb_build_object('currency','USD','policy_version',p.version,'base_cents',p.base_cents,'distance_cents',distance_cost,'pallet_cents',pallet_cost,'payload_cents',weight_cost,'urgency_cents',rush,'minimum_adjustment_cents',amount-subtotal-rush,'total_cents',amount,'driver_cents',driver_amount,'service_fee_cents',amount-driver_amount,'mile_rate_cents',p.mile_cents,'miles',miles,'urgency',urgency);
end $$;
revoke all on function at_private.hub_quote(public.at_service_hub_policies,numeric,integer,integer,text) from public,anon,authenticated;

create function at_private.save_hub_policy(p_organization_id uuid,p_enabled boolean,p_display_name text,p_base integer,p_mile integer,p_pallet integer,p_weight integer,p_minimum integer,p_driver_share integer,p_driver_floor integer,p_payload integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=auth.uid() and role='admin') then raise exception 'Company administrator required' using errcode='42501';end if;
 insert into public.at_service_hub_policies(organization_id,enabled,display_name,base_cents,mile_cents,pallet_cents,weight_1000_cents,minimum_cents,driver_share_bps,driver_floor_cents,max_payload_lbs)
 values(p_organization_id,p_enabled,btrim(p_display_name),p_base,p_mile,p_pallet,p_weight,p_minimum,p_driver_share,p_driver_floor,p_payload)
 on conflict(organization_id) do update set enabled=excluded.enabled,display_name=excluded.display_name,base_cents=excluded.base_cents,mile_cents=excluded.mile_cents,pallet_cents=excluded.pallet_cents,weight_1000_cents=excluded.weight_1000_cents,minimum_cents=excluded.minimum_cents,driver_share_bps=excluded.driver_share_bps,driver_floor_cents=excluded.driver_floor_cents,max_payload_lbs=excluded.max_payload_lbs,version=at_service_hub_policies.version+1,updated_at=now();
end $$;
create function at_private.submit_customer_request(p_organization_id uuid,p_service text,p_pickup text,p_dropoff text,p_description text,p_pallets integer,p_payload integer,p_miles numeric,p_window_start timestamptz,p_window_end timestamptz,p_urgency text,p_nonce uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare policy public.at_service_hub_policies;result uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed customer email required' using errcode='42501';end if;
 select id into result from public.at_customer_requests where customer_user_id=auth.uid() and client_nonce=p_nonce;if found then return result;end if;
 select * into policy from public.at_service_hub_policies where organization_id=p_organization_id and enabled;
 if not found then raise exception 'This provider is not accepting requests' using errcode='22023';end if;
 if p_payload is null or p_payload<1 or p_payload>policy.max_payload_lbs or p_miles is null or p_miles<1 or p_miles>10000 or p_window_start is null or p_window_start<now() or p_window_end is null or p_window_end<=p_window_start or p_window_end>now()+interval '90 days' then raise exception 'Check payload, mileage and future delivery window' using errcode='22023';end if;
 insert into public.at_customer_requests(organization_id,customer_user_id,client_nonce,service_id,pickup_address,dropoff_address,description,pallets,payload_lbs,requested_miles,window_start,window_end,urgency,quote)
 values(p_organization_id,auth.uid(),p_nonce,p_service,btrim(p_pickup),btrim(p_dropoff),btrim(p_description),p_pallets,p_payload,p_miles,p_window_start,p_window_end,p_urgency,at_private.hub_quote(policy,p_miles,p_pallets,p_payload,p_urgency)) returning id into result;
 return result;
end $$;
create function at_private.review_customer_quote(p_request_id uuid,p_verified_miles numeric) returns void language plpgsql security definer set search_path='' as $$
declare r public.at_customer_requests;policy public.at_service_hub_policies;
begin
 select * into r from public.at_customer_requests where id=p_request_id for update;
 if not found or not exists(select 1 from public.at_organization_members where organization_id=r.organization_id and user_id=auth.uid() and role in ('admin','dispatcher')) then raise exception 'Dispatch permission required' using errcode='42501';end if;
 if r.status not in ('submitted','quote_ready') or p_verified_miles is null or p_verified_miles<1 or p_verified_miles>10000 or r.window_end<=now() then raise exception 'Request is not quotable or distance is invalid' using errcode='22023';end if;
 select * into policy from public.at_service_hub_policies where organization_id=r.organization_id and enabled;
 if not found or r.payload_lbs>policy.max_payload_lbs then raise exception 'Provider unavailable or payload exceeds its limit';end if;
 update public.at_customer_requests set reviewed_miles=p_verified_miles,quote=at_private.hub_quote(policy,p_verified_miles,r.pallets,r.payload_lbs,r.urgency),status='quote_ready',reviewed_by=auth.uid(),quote_expires_at=least(now()+interval '24 hours',r.window_end),updated_at=now() where id=r.id;
end $$;
create function at_private.accept_customer_quote(p_request_id uuid,p_expected_total bigint) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.at_customer_requests;job uuid;
begin
 select * into r from public.at_customer_requests where id=p_request_id for update;
 if not found or r.customer_user_id<>auth.uid() or auth.uid() is null then raise exception 'Customer permission required' using errcode='42501';end if;
 if r.status='booked' then return r.assignment_id;end if;
 if r.status<>'quote_ready' or r.quote_expires_at<=now() or p_expected_total is null or p_expected_total<>(r.quote->>'total_cents')::bigint then raise exception 'Quote changed or expired. Review the current quote before booking' using errcode='22023';end if;
 insert into public.at_assignments(organization_id,service_id,required_license_class,reference,division,customer_name,commodity,pickup_address,dropoff_address,estimated_miles,scheduled_pickup_at,scheduled_delivery_at,created_by)
 values(r.organization_id,r.service_id,case when r.service_id in ('freight','otr') then 'A' else 'C' end,'HUB-'||r.id::text,case when r.service_id in ('freight','otr') then 'CDL' else 'Class C' end,'Hub customer',r.description,r.pickup_address,r.dropoff_address,r.reviewed_miles,r.window_start,r.window_end,auth.uid()) returning id into job;
 update public.at_customer_requests set status='booked',assignment_id=job,updated_at=now() where id=r.id;
 return job;
end $$;
create function at_private.cancel_customer_request(p_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.at_customer_requests where id=p_request_id and customer_user_id=auth.uid()) then raise exception 'Customer permission required' using errcode='42501';end if;
 update public.at_customer_requests set status='cancelled',updated_at=now() where id=p_request_id and customer_user_id=auth.uid() and status in ('submitted','quote_ready');
 if not found then raise exception 'Booked shipments must be resolved with dispatch';end if;
end $$;

create function at_private.customer_shipment_status(p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.at_customer_requests;a public.at_assignments;gps jsonb;proof jsonb;events jsonb;
begin
 if not at_private.can_read_customer_request(p_request_id) then raise exception 'Shipment permission required' using errcode='42501';end if;
 select * into r from public.at_customer_requests where id=p_request_id;select * into a from public.at_assignments where id=r.assignment_id;
 -- Temporary per-shipment entitlement. No GPS after delivery/cancellation or on another load.
 if a.status='in_transit' then select jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'last_ping_at',l.last_ping_at,'online',true,'sharing',true) into gps from public.at_live_driver_locations l where l.organization_id=r.organization_id and l.driver_user_id=a.driver_user_id and l.online and l.sharing and l.latitude is not null and l.longitude is not null and l.last_ping_at>now()-interval '60 seconds';end if;
 if a.status='delivered' then select jsonb_build_object('confirmed_at',p.confirmed_at,'evidence_path',p.evidence_path) into proof from public.at_delivery_proofs p where p.assignment_id=a.id;end if;
 select coalesce(jsonb_agg(x order by x.occurred_at),'[]'::jsonb) into events from(select action,next_status,occurred_at from public.at_assignment_events where assignment_id=a.id order by occurred_at desc limit 100)x;
 return jsonb_build_object('status',coalesce(a.status,r.status),'updated_at',coalesce(a.updated_at,r.updated_at),'gps',gps,'proof',proof,'events',events,'tracking_expires_at',case when gps is not null then (gps->>'last_ping_at')::timestamptz+interval '60 seconds' end);
end $$;
create policy customer_reads_own_confirmed_photo on storage.objects for select to authenticated using(bucket_id='at-delivery-evidence' and exists(select 1 from public.at_delivery_proofs p join public.at_customer_requests r on r.assignment_id=p.assignment_id where r.customer_user_id=(select auth.uid()) and p.evidence_path=storage.objects.name));
-- The policy's proof metadata subquery also needs a narrowly scoped SELECT policy.
create policy customer_reads_own_delivery_proof on public.at_delivery_proofs for select to authenticated using(exists(select 1 from public.at_customer_requests r where r.assignment_id=at_delivery_proofs.assignment_id and r.customer_user_id=(select auth.uid())));

create function at_private.guard_customer_payload() returns trigger language plpgsql security definer set search_path='' as $$
declare required integer;capacity integer;
begin
 if new.status in ('offered','accepted','at_pickup','picked_up','in_transit') then
 select payload_lbs into required from public.at_customer_requests where assignment_id=new.id;
 if found then select payload_capacity_lbs into capacity from public.at_vehicles where id=new.vehicle_id and organization_id=new.organization_id;
 if capacity is null or capacity<required then raise exception 'Verified vehicle payload capacity must cover the customer load' using errcode='23514';end if;end if;end if;return new;
end $$;
create trigger guard_customer_payload before update on public.at_assignments for each row execute function at_private.guard_customer_payload();

create function at_private.customer_task_terms(p_organization_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('assignment_id',r.assignment_id,'pallets',r.pallets,'payload_lbs',r.payload_lbs,'window_start',r.window_start,'window_end',r.window_end,'urgency',r.urgency,'quote',r.quote)),'[]'::jsonb) from public.at_customer_requests r join public.at_assignments a on a.id=r.assignment_id where r.organization_id=p_organization_id and auth.uid() is not null and ((a.driver_user_id=auth.uid() and exists(select 1 from public.at_organization_members dm where dm.organization_id=r.organization_id and dm.user_id=auth.uid() and dm.role='driver')) or exists(select 1 from public.at_organization_members m where m.organization_id=r.organization_id and m.user_id=auth.uid() and m.role in ('admin','dispatcher')))
$$;

revoke all on function at_private.save_hub_policy(uuid,boolean,text,integer,integer,integer,integer,integer,integer,integer,integer) from public,anon;grant execute on function at_private.save_hub_policy(uuid,boolean,text,integer,integer,integer,integer,integer,integer,integer,integer) to authenticated;
create function public.at_save_hub_policy(p_organization_id uuid,p_enabled boolean,p_display_name text,p_base integer,p_mile integer,p_pallet integer,p_weight integer,p_minimum integer,p_driver_share integer,p_driver_floor integer,p_payload integer) returns void language sql security invoker set search_path='' as $$select at_private.save_hub_policy(p_organization_id,p_enabled,p_display_name,p_base,p_mile,p_pallet,p_weight,p_minimum,p_driver_share,p_driver_floor,p_payload)$$;
revoke all on function public.at_save_hub_policy(uuid,boolean,text,integer,integer,integer,integer,integer,integer,integer,integer) from public,anon;grant execute on function public.at_save_hub_policy(uuid,boolean,text,integer,integer,integer,integer,integer,integer,integer,integer) to authenticated;

revoke all on function at_private.submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid) from public,anon;grant execute on function at_private.submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid) to authenticated;
create function public.at_submit_customer_request(p_organization_id uuid,p_service text,p_pickup text,p_dropoff text,p_description text,p_pallets integer,p_payload integer,p_miles numeric,p_window_start timestamptz,p_window_end timestamptz,p_urgency text,p_nonce uuid) returns uuid language sql security invoker set search_path='' as $$select at_private.submit_customer_request(p_organization_id,p_service,p_pickup,p_dropoff,p_description,p_pallets,p_payload,p_miles,p_window_start,p_window_end,p_urgency,p_nonce)$$;
revoke all on function public.at_submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid) from public,anon;grant execute on function public.at_submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid) to authenticated;

revoke all on function at_private.review_customer_quote(uuid,numeric) from public,anon;grant execute on function at_private.review_customer_quote(uuid,numeric) to authenticated;
create function public.at_review_customer_quote(p_request_id uuid,p_verified_miles numeric) returns void language sql security invoker set search_path='' as $$select at_private.review_customer_quote(p_request_id,p_verified_miles)$$;
revoke all on function public.at_review_customer_quote(uuid,numeric) from public,anon;grant execute on function public.at_review_customer_quote(uuid,numeric) to authenticated;

revoke all on function at_private.accept_customer_quote(uuid,bigint) from public,anon;grant execute on function at_private.accept_customer_quote(uuid,bigint) to authenticated;
create function public.at_accept_customer_quote(p_request_id uuid,p_expected_total bigint) returns uuid language sql security invoker set search_path='' as $$select at_private.accept_customer_quote(p_request_id,p_expected_total)$$;
revoke all on function public.at_accept_customer_quote(uuid,bigint) from public,anon;grant execute on function public.at_accept_customer_quote(uuid,bigint) to authenticated;

revoke all on function at_private.cancel_customer_request(uuid) from public,anon;grant execute on function at_private.cancel_customer_request(uuid) to authenticated;
create function public.at_cancel_customer_request(p_request_id uuid) returns void language sql security invoker set search_path='' as $$select at_private.cancel_customer_request(p_request_id)$$;
revoke all on function public.at_cancel_customer_request(uuid) from public,anon;grant execute on function public.at_cancel_customer_request(uuid) to authenticated;

revoke all on function at_private.customer_shipment_status(uuid) from public,anon;grant execute on function at_private.customer_shipment_status(uuid) to authenticated;
create function public.at_customer_shipment_status(p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$select at_private.customer_shipment_status(p_request_id)$$;
revoke all on function public.at_customer_shipment_status(uuid) from public,anon;grant execute on function public.at_customer_shipment_status(uuid) to authenticated;

revoke all on function at_private.customer_task_terms(uuid) from public,anon;grant execute on function at_private.customer_task_terms(uuid) to authenticated;
create function public.at_customer_task_terms(p_organization_id uuid) returns jsonb language sql security invoker set search_path='' as $$select at_private.customer_task_terms(p_organization_id)$$;
revoke all on function public.at_customer_task_terms(uuid) from public,anon;grant execute on function public.at_customer_task_terms(uuid) to authenticated;
