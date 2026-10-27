-- Rollback-only service-form and rate regression. No Auth identities are created.
begin;
select set_config('qa.service_org',(select organization_id::text from public.at_organization_members where role='admin' order by created_at limit 1),true);
select set_config('qa.service_user',(select user_id::text from public.at_organization_members where organization_id=current_setting('qa.service_org')::uuid and role='admin' limit 1),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.service_user'),'role','authenticated')::text,true);
set local role authenticated;
select public.at_save_hub_policy(current_setting('qa.service_org')::uuid,true,'QA Service Forms',2500,200,1000,500,5000,8000,4000,44000);
do $$declare food_id uuid;other_id uuid;r public.at_customer_requests;service text;details jsonb;begin
 food_id:=public.at_submit_customer_request(current_setting('qa.service_org')::uuid,'food','QA Restaurant','QA Customer','Food delivery instructions',null,null,5,now()+interval '1 day',now()+interval '26 hours','standard',gen_random_uuid(),'{"restaurant_name":"QA Cafe","order_reference":"ORDER-31","meal_count":3,"food_handling":"hot","equipment":"flatbed"}');
 select * into r from public.at_customer_requests where id=food_id;
 if r.pallets is not null or r.payload_lbs is not null or r.service_details->>'restaurant_name'<>'QA Cafe' or r.service_details ? 'equipment' then raise exception 'Food retained freight fields or lost actual service details';end if;
 if (r.quote->>'pallet_cents')::integer<>0 or (r.quote->>'payload_cents')::integer<>0 or (r.quote->>'total_cents')::integer<>5000 or r.quote->>'service_id'<>'food' then raise exception 'Food estimate contains freight fees';end if;
 perform public.at_review_customer_quote(food_id,6);
 select * into r from public.at_customer_requests where id=food_id;
 if (r.quote->>'payload_cents')::integer<>0 or (r.quote->>'pallet_cents')::integer<>0 then raise exception 'Reviewed food quote gained freight charges';end if;
 perform public.at_accept_customer_quote(food_id,(r.quote->>'total_cents')::bigint);
 -- Submitted hidden pallet/weight values must be discarded even for a malicious client.
 other_id:=public.at_submit_customer_request(current_setting('qa.service_org')::uuid,'food','QA Restaurant','QA Customer','Another order',26,100000,5,now()+interval '1 day',now()+interval '26 hours','standard',gen_random_uuid(),'{"restaurant_name":"QA Cafe","order_reference":"ORDER-32","meal_count":1,"food_handling":"cold"}');
 select * into r from public.at_customer_requests where id=other_id;
 if r.pallets is not null or r.payload_lbs is not null or (r.quote->>'payload_cents')::integer<>0 then raise exception 'Hidden weight affected food request';end if;
 begin perform public.at_submit_customer_request(current_setting('qa.service_org')::uuid,'food','QA Restaurant','QA Customer','Bad order',null,null,5,now()+interval '1 day',now()+interval '26 hours','standard',gen_random_uuid(),'{"restaurant_name":"QA Cafe","order_reference":"ORDER-0","meal_count":0,"food_handling":"hot"}');raise exception 'Invalid food count accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
 begin perform public.at_submit_customer_request(current_setting('qa.service_org')::uuid,'courier','QA Pickup','QA Destination','Package delivery',null,null,5,now()+interval '1 day',now()+interval '26 hours','standard',gen_random_uuid(),'{"package_count":2,"package_type":"parcels"}');raise exception 'Courier weight not required' using errcode='XX000';exception when invalid_parameter_value then null;end;
 other_id:=public.at_submit_customer_request(current_setting('qa.service_org')::uuid,'courier','QA Pickup','QA Destination','Package delivery',26,4200,65,now()+interval '1 day',now()+interval '26 hours','priority',gen_random_uuid(),'{"package_count":2,"package_type":"parcels"}');
 select * into r from public.at_customer_requests where id=other_id;
 if r.pallets is not null or r.payload_lbs<>4200 or (r.quote->>'pallet_cents')::integer<>0 or (r.quote->>'payload_cents')::integer<>2500 then raise exception 'Courier pricing is not package-weight-only';end if;
 foreach service in array array['freight','otr','rideshare','waste'] loop
 details:=case service when 'freight' then '{"equipment":"box_truck"}'::jsonb when 'otr' then '{"equipment":"dry_van"}'::jsonb when 'rideshare' then '{"passenger_count":2,"luggage_count":1}'::jsonb else '{"waste_category":"bulky","item_count":2,"volume_cuyd":3}'::jsonb end;
 other_id:=public.at_submit_customer_request(current_setting('qa.service_org')::uuid,service,'QA Pickup','QA Destination','QA service details',4,4200,65,now()+interval '1 day',now()+interval '26 hours','priority',gen_random_uuid(),details);
 select * into r from public.at_customer_requests where id=other_id;
 if service in ('freight','otr') then
  if r.pallets<>4 or r.payload_lbs<>4200 or (r.quote->>'total_cents')::integer<>27500 then raise exception 'Freight pricing regressed';end if;
 else
  if r.pallets is not null or r.payload_lbs is not null or (r.quote->>'total_cents')::integer<>19375 then raise exception 'Non-cargo service retained freight data or fees';end if;
 end if;
 end loop;
end $$;
reset role;
rollback;
select 'PASS: actual service fields persisted, food needs no weight/pallets, hidden freight values ignored, service quotes correct, cargo checks retained; all fixtures rolled back' as result;
