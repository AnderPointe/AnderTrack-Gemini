-- Service-specific details. Existing approved quote snapshots are not rewritten.
alter table public.at_customer_requests alter column pallets drop not null;
alter table public.at_customer_requests alter column payload_lbs drop not null;
alter table public.at_customer_requests add column service_details jsonb not null default '{}'::jsonb check(jsonb_typeof(service_details)='object' and length(service_details::text)<=4000);

create function at_private.hub_detail_count(d jsonb,k text,lo integer,hi integer) returns integer language plpgsql immutable set search_path='' as $$
declare n numeric;begin
 if jsonb_typeof(d->k) is distinct from 'number' then raise exception 'Invalid service count: %',k using errcode='22023';end if;
 n:=(d->>k)::numeric;if n<lo or n>hi or n<>trunc(n) then raise exception 'Invalid service count: %',k using errcode='22023';end if;return n::integer;
end $$;
create function at_private.hub_detail_text(d jsonb,k text,lo integer,hi integer) returns text language plpgsql immutable set search_path='' as $$
declare value text:=btrim(coalesce(d->>k,''));begin
 if (d ? k and jsonb_typeof(d->k) is distinct from 'string') or length(value)<lo or length(value)>hi then raise exception 'Invalid service detail: %',k using errcode='22023';end if;return value;
end $$;
create function at_private.valid_hub_service_details(service text,d jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare value text;result jsonb;begin
 if d is null or jsonb_typeof(d)<>'object' or length(d::text)>4000 then raise exception 'Invalid service details' using errcode='22023';end if;
 case service
 when 'freight','otr' then
  value:=coalesce(d->>'equipment','dispatch_review');if value not in ('box_truck','dry_van','flatbed','reefer','dispatch_review') then raise exception 'Choose valid equipment' using errcode='22023';end if;
  result:=jsonb_build_object('equipment',value);
 when 'courier' then
  value:=d->>'package_type';if value is null or value not in ('parcels','documents','fragile') then raise exception 'Choose a package type' using errcode='22023';end if;
  result:=jsonb_build_object('package_count',at_private.hub_detail_count(d,'package_count',1,250),'package_type',value);
 when 'food' then
  value:=d->>'food_handling';if value is null or value not in ('hot','cold','mixed') then raise exception 'Choose food handling' using errcode='22023';end if;
  result:=jsonb_build_object('restaurant_name',at_private.hub_detail_text(d,'restaurant_name',2,160),'order_reference',at_private.hub_detail_text(d,'order_reference',2,80),'meal_count',at_private.hub_detail_count(d,'meal_count',1,200),'food_handling',value);
 when 'rideshare' then
  result:=jsonb_build_object('passenger_count',at_private.hub_detail_count(d,'passenger_count',1,8),'luggage_count',at_private.hub_detail_count(d,'luggage_count',0,12),'accessibility_notes',at_private.hub_detail_text(d,'accessibility_notes',0,500));
 when 'waste' then
  value:=d->>'waste_category';if value is null or value not in ('bulky','household','yard','construction') then raise exception 'Choose a supported waste type' using errcode='22023';end if;
  result:=jsonb_build_object('waste_category',value,'item_count',at_private.hub_detail_count(d,'item_count',1,100),'volume_cuyd',at_private.hub_detail_count(d,'volume_cuyd',1,40));
 else raise exception 'Unknown service' using errcode='22023';end case;
 return result;
end $$;
revoke all on function at_private.hub_detail_count(jsonb,text,integer,integer),at_private.hub_detail_text(jsonb,text,integer,integer),at_private.valid_hub_service_details(text,jsonb) from public,anon,authenticated;
create function at_private.hub_service_quote(p public.at_service_hub_policies,service text,miles numeric,pallets integer,payload integer,urgency text) returns jsonb language sql immutable set search_path='' as $$
 select at_private.hub_quote(p,miles,case when service in ('freight','otr') then pallets else 0 end,case when service in ('freight','otr','courier') then payload else 0 end,urgency)||jsonb_build_object('service_id',service)
$$;
revoke all on function at_private.hub_service_quote(public.at_service_hub_policies,text,numeric,integer,integer,text) from public,anon,authenticated;
drop function public.at_submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid);
drop function at_private.submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid);
create function at_private.submit_customer_request(p_organization_id uuid,p_service text,p_pickup text,p_dropoff text,p_description text,p_pallets integer,p_payload integer,p_miles numeric,p_window_start timestamptz,p_window_end timestamptz,p_urgency text,p_nonce uuid,p_service_details jsonb default '{}'::jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare policy public.at_service_hub_policies;result uuid;details jsonb;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Confirmed customer email required' using errcode='42501';end if;
 select id into result from public.at_customer_requests where customer_user_id=auth.uid() and client_nonce=p_nonce;if found then return result;end if;
 select * into policy from public.at_service_hub_policies where organization_id=p_organization_id and enabled;
 if not found then raise exception 'This provider is not accepting requests' using errcode='22023';end if;
 details:=at_private.valid_hub_service_details(p_service,p_service_details);
 if (p_service in ('freight','otr','courier') and (p_payload is null or p_payload<1 or p_payload>policy.max_payload_lbs)) or (p_service in ('freight','otr') and (p_pallets is null or p_pallets<0 or p_pallets>26)) or p_miles is null or p_miles<1 or p_miles>10000 or p_window_start is null or p_window_start<now() or p_window_end is null or p_window_end<=p_window_start or p_window_end>now()+interval '90 days' then raise exception 'Check service requirements, mileage and future time window' using errcode='22023';end if;
 insert into public.at_customer_requests(organization_id,customer_user_id,client_nonce,service_id,pickup_address,dropoff_address,description,pallets,payload_lbs,requested_miles,window_start,window_end,urgency,quote,service_details)
 values(p_organization_id,auth.uid(),p_nonce,p_service,btrim(p_pickup),btrim(p_dropoff),btrim(p_description),case when p_service in ('freight','otr') then p_pallets end,case when p_service in ('freight','otr','courier') then p_payload end,p_miles,p_window_start,p_window_end,p_urgency,at_private.hub_service_quote(policy,p_service,p_miles,p_pallets,p_payload,p_urgency),details) returning id into result;
 return result;
end $$;
create or replace function at_private.review_customer_quote(p_request_id uuid,p_verified_miles numeric) returns void language plpgsql security definer set search_path='' as $$
declare r public.at_customer_requests;policy public.at_service_hub_policies;
begin
 select * into r from public.at_customer_requests where id=p_request_id for update;
 if not found or not exists(select 1 from public.at_organization_members where organization_id=r.organization_id and user_id=auth.uid() and role in ('admin','dispatcher')) then raise exception 'Dispatch permission required' using errcode='42501';end if;
 if r.status not in ('submitted','quote_ready') or p_verified_miles is null or p_verified_miles<1 or p_verified_miles>10000 or r.window_end<=now() then raise exception 'Request is not quotable or distance is invalid' using errcode='22023';end if;
 select * into policy from public.at_service_hub_policies where organization_id=r.organization_id and enabled;
 if not found or r.payload_lbs>policy.max_payload_lbs then raise exception 'Provider unavailable or payload exceeds its limit';end if;
 update public.at_customer_requests set reviewed_miles=p_verified_miles,quote=at_private.hub_service_quote(policy,r.service_id,p_verified_miles,r.pallets,r.payload_lbs,r.urgency),status='quote_ready',reviewed_by=auth.uid(),quote_expires_at=least(now()+interval '24 hours',r.window_end),updated_at=now() where id=r.id;
end $$;
create or replace function at_private.guard_customer_payload() returns trigger language plpgsql security definer set search_path='' as $$
declare required integer;capacity integer;
begin
 if new.status in ('offered','accepted','at_pickup','picked_up','in_transit') then
 select payload_lbs into required from public.at_customer_requests where assignment_id=new.id;
 if found and required is not null then select payload_capacity_lbs into capacity from public.at_vehicles where id=new.vehicle_id and organization_id=new.organization_id;
 if capacity is null or capacity<required then raise exception 'Verified vehicle payload capacity must cover the customer load' using errcode='23514';end if;end if;end if;return new;
end $$;

revoke all on function at_private.submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid,jsonb) from public,anon;grant execute on function at_private.submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid,jsonb) to authenticated;
create function public.at_submit_customer_request(p_organization_id uuid,p_service text,p_pickup text,p_dropoff text,p_description text,p_pallets integer,p_payload integer,p_miles numeric,p_window_start timestamptz,p_window_end timestamptz,p_urgency text,p_nonce uuid,p_service_details jsonb default '{}'::jsonb) returns uuid language sql security invoker set search_path='' as $$select at_private.submit_customer_request(p_organization_id,p_service,p_pickup,p_dropoff,p_description,p_pallets,p_payload,p_miles,p_window_start,p_window_end,p_urgency,p_nonce,p_service_details)$$;
revoke all on function public.at_submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid,jsonb) from public,anon;grant execute on function public.at_submit_customer_request(uuid,text,text,text,text,integer,integer,numeric,timestamptz,timestamptz,text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
