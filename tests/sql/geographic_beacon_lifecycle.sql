-- GEOGRAPHIC SPREAD / STALE / RECOVERY REGRESSION.
-- STAGING ONLY. All identities, requests, GPS, messages and evidence metadata roll back.
-- SQL role simulation, not real Auth signup, browser GPS, image bytes or multi-connection races.
begin;
set local statement_timeout='25s';
select set_config('qa.all_org',gen_random_uuid()::text,true);
select set_config('qa.all_admin',gen_random_uuid()::text,true);
create temporary table qa_service_runs(ordinal integer,service text,driver uuid default gen_random_uuid(),customer uuid default gen_random_uuid(),vehicle uuid default gen_random_uuid(),latitude double precision,longitude double precision,request uuid,job uuid,token uuid,photo text) on commit drop;
insert into qa_service_runs(ordinal,service) values(1,'freight'),(2,'otr'),(3,'courier'),(4,'food'),(5,'rideshare'),(6,'waste');
insert into auth.users(instance_id,id,aud,role,email,created_at,updated_at,email_confirmed_at)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated','audit-'||id||'@example.invalid',now(),now(),now()
from(select driver id from qa_service_runs union all select customer from qa_service_runs union all select current_setting('qa.all_admin')::uuid)x;
insert into public.at_organizations(id,name) values(current_setting('qa.all_org')::uuid,'Rollback six-service audit');
insert into public.at_organization_members(organization_id,user_id,role) select current_setting('qa.all_org')::uuid,driver,'driver' from qa_service_runs;
insert into public.at_organization_members(organization_id,user_id,role) values(current_setting('qa.all_org')::uuid,current_setting('qa.all_admin')::uuid,'admin');
insert into public.at_driver_profiles(organization_id,user_id,display_name,license_class,license_verified,availability)
select current_setting('qa.all_org')::uuid,driver,'Audit '||service,case when service in ('freight','otr') then 'A' else 'C' end,true,'available' from qa_service_runs;
insert into public.at_vehicles(id,organization_id,unit_number,vehicle_type,required_license_class,payload_capacity_lbs,enabled)
select vehicle,current_setting('qa.all_org')::uuid,'AUDIT-'||service,case when service in ('freight','otr') then 'tractor' when service='rideshare' then 'car' else 'cargo_van' end,case when service in ('freight','otr') then 'A' else 'C' end,10000,true from qa_service_runs;
update qa_service_runs set latitude=(array[32.75,28.54,47.61,34.05,41.88,40.71]::double precision[])[ordinal],longitude=(array[-97.33,-81.38,-122.33,-118.24,-87.63,-74.01]::double precision[])[ordinal];
grant select,update on qa_service_runs to authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.all_admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.at_save_hub_policy(current_setting('qa.all_org')::uuid,true,'Audit Services',2500,200,1000,500,5000,8000,4000,44000);
do $$declare r record;begin
 for r in select * from qa_service_runs order by ordinal loop
  perform public.at_set_driver_service_access(current_setting('qa.all_org')::uuid,r.driver,r.service,true,'Isolated rollback qualification fixture');
 end loop;
end $$;
do $$declare r record;details jsonb;rid uuid;jid uuid;s jsonb;begin
 for r in select * from qa_service_runs order by ordinal loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.customer,'role','authenticated')::text,true);
  details:=case r.service when 'freight' then '{"equipment":"box_truck"}'::jsonb when 'otr' then '{"equipment":"dry_van"}'::jsonb when 'courier' then '{"package_count":2,"package_type":"parcels"}'::jsonb when 'food' then '{"restaurant_name":"Audit Cafe","order_reference":"QA-FOOD","meal_count":3,"food_handling":"hot"}'::jsonb when 'rideshare' then '{"passenger_count":2,"luggage_count":1}'::jsonb else '{"waste_category":"bulky","item_count":2,"volume_cuyd":3}'::jsonb end;
  rid:=public.at_submit_customer_request(current_setting('qa.all_org')::uuid,r.service,'Audit Pickup','Audit Destination','Synthetic service request',case when r.service in ('freight','otr') then 4 else null end,case when r.service in ('freight','otr','courier') then 4200 else null end,10,now()+interval '1 day',now()+interval '26 hours','standard',gen_random_uuid(),details);
  update qa_service_runs set request=rid where ordinal=r.ordinal;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.all_admin'),'role','authenticated')::text,true);
  perform public.at_review_customer_quote(rid,12);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.customer,'role','authenticated')::text,true);
  jid:=public.at_accept_customer_quote(rid,(select (quote->>'total_cents')::bigint from public.at_customer_requests where id=rid));
  update qa_service_runs set job=jid where ordinal=r.ordinal;
 end loop;
end $$;
do $$declare r record;t uuid;begin
 for r in select * from qa_service_runs order by ordinal loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.driver,'role','authenticated')::text,true);
  t:=public.at_begin_driver_tracking(current_setting('qa.all_org')::uuid);
  update qa_service_runs set token=t where ordinal=r.ordinal;
  perform public.at_publish_driver_location(current_setting('qa.all_org')::uuid,t,r.latitude,r.longitude,8,clock_timestamp(),0,0);
  perform public.at_set_driver_online(current_setting('qa.all_org')::uuid,true,t);
  perform public.at_consent_customer_tracking(current_setting('qa.all_org')::uuid,t);
  perform public.at_join_driver_queue(current_setting('qa.all_org')::uuid,r.service);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.all_admin'),'role','authenticated')::text,true);
 if (select count(*) from public.at_driver_queue_snapshot(current_setting('qa.all_org')::uuid))<>6 then raise exception 'Six service requests not queued';end if;
 for r in select * from qa_service_runs order by ordinal loop
  perform public.at_offer_assignment(r.job,r.driver,r.vehicle);
 end loop;
end $$;
do $$declare r record;begin
 for r in select * from qa_service_runs order by ordinal loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.driver,'role','authenticated')::text,true);
  perform public.at_respond_assignment(r.job,true);
  perform public.at_advance_assignment(r.job,'at_pickup');
  perform public.at_advance_assignment(r.job,'picked_up');
  perform public.at_advance_assignment(r.job,'in_transit');
  if (select count(*) from public.at_live_driver_locations where organization_id=current_setting('qa.all_org')::uuid)<>1 then raise exception 'Driver can see other drivers GPS';end if;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.all_admin'),'role','authenticated')::text,true);
 if (select count(*) from public.at_live_driver_locations where organization_id=current_setting('qa.all_org')::uuid and online and sharing)<>6 then raise exception 'Dispatch cannot see six simultaneous GPS feeds';end if;
 if (select count(*) from public.at_assignments where organization_id=current_setting('qa.all_org')::uuid and status='in_transit')<>6 then raise exception 'Six simultaneous trips not in transit';end if;
end $$;
reset role;
update public.at_live_driver_locations set last_ping_at=clock_timestamp()-interval '70 seconds' where organization_id=current_setting('qa.all_org')::uuid;
set local role authenticated;
do $$declare r record;begin
 for r in select * from qa_service_runs order by ordinal loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.customer,'role','authenticated')::text,true);
  if public.at_customer_shipment_status(r.request)->'gps'<>'null'::jsonb then raise exception 'Stale national beacon exposed to customer';end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.driver,'role','authenticated')::text,true);
  perform public.at_publish_driver_location(current_setting('qa.all_org')::uuid,r.token,r.latitude+.002,r.longitude+.002,8,clock_timestamp(),90,20);
 end loop;
end $$;
do $$declare r record;s jsonb;begin
 for r in select * from qa_service_runs order by ordinal loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.customer,'role','authenticated')::text,true);
  s:=public.at_customer_shipment_status(r.request);
  if abs((s->'gps'->>'latitude')::double precision-r.latitude-.002)>.000001 then raise exception 'Customer shipment location mismatch';end if;
  if (select count(*) from public.at_customer_requests)<>1 then raise exception 'Customer sees another shipment';end if;
  insert into public.at_shipment_messages(request_id,body,client_nonce) values(r.request,'Audit customer message',gen_random_uuid());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.driver,'role','authenticated')::text,true);
  if not exists(select 1 from public.at_shipment_messages where request_id=r.request and body='Audit customer message') then raise exception 'Driver did not receive customer message';end if;
  insert into public.at_shipment_messages(request_id,body,client_nonce) values(r.request,'Audit driver reply',gen_random_uuid());
  insert into public.at_dispatch_messages(organization_id,driver_user_id,body,client_nonce) values(current_setting('qa.all_org')::uuid,r.driver,'Audit dispatch request',gen_random_uuid());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.all_admin'),'role','authenticated')::text,true);
  if not exists(select 1 from public.at_dispatch_messages where driver_user_id=r.driver and body='Audit dispatch request') then raise exception 'Dispatch did not receive driver message';end if;
  insert into public.at_dispatch_messages(organization_id,driver_user_id,body,client_nonce) values(current_setting('qa.all_org')::uuid,r.driver,'Audit dispatch reply',gen_random_uuid());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.driver,'role','authenticated')::text,true);
  if not exists(select 1 from public.at_dispatch_messages where driver_user_id=r.driver and body='Audit dispatch reply') then raise exception 'Driver did not receive dispatch reply';end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.customer,'role','authenticated')::text,true);
  if not exists(select 1 from public.at_shipment_messages where request_id=r.request and body='Audit driver reply') then raise exception 'Customer did not receive reply';end if;
 end loop;
end $$;
reset role;
update qa_service_runs set photo=current_setting('qa.all_org')||'/'||job||'/'||driver||'/'||gen_random_uuid()||'.jpg';
insert into storage.objects(bucket_id,name,metadata) select 'at-delivery-evidence',photo,'{"mimetype":"image/jpeg","size":128}'::jsonb from qa_service_runs;
set local role authenticated;
do $$declare r record;s jsonb;begin
 for r in select * from qa_service_runs order by ordinal loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.driver,'role','authenticated')::text,true);
  perform public.at_confirm_delivery(r.job,'Audit Recipient',r.photo,'Synthetic metadata only, not image upload verification');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',r.customer,'role','authenticated')::text,true);
  s:=public.at_customer_shipment_status(r.request);
  if s->>'status'<>'delivered' or s->'gps'<>'null'::jsonb or s->'proof'->>'evidence_path'<>r.photo then raise exception 'Delivery or tracking cutoff failed: %',r.service;end if;
 end loop;
end $$;
reset role;
rollback;
select 'PASS: six geographically spread beacons (TX/FL/WA/CA/IL/NY), stale customer location cutoff, fresh moving recovery, six isolated customer requests, reviewed quotes, FIFO offers, six drivers accept/progress simultaneously, six dispatcher GPS rows, customer-scoped GPS, two-way customer/driver/dispatch messages, six photo-metadata deliveries and tracking cutoffs. All synthetic identities and records rolled back.' as result;
