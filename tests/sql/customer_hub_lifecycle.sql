-- Rollback-only lifecycle test. Reuses two existing Auth users. No photos are uploaded;
-- a synthetic Storage metadata row tests server evidence checks, not image delivery.
begin;
select set_config('qa.hub_org',(select organization_id::text from public.at_driver_profiles where display_name='AnderTrack Staging Driver' limit 1),true);
select set_config('qa.hub_driver',(select user_id::text from public.at_driver_profiles where display_name='AnderTrack Staging Driver' limit 1),true);
select set_config('qa.hub_customer',(select user_id::text from public.at_organization_members where organization_id=current_setting('qa.hub_org')::uuid and role='admin' limit 1),true);
do $$begin
 if exists(select 1 from public.at_assignments where driver_user_id=current_setting('qa.hub_driver')::uuid and status in ('offered','assigned','accepted','at_pickup','picked_up','in_transit')) or exists(select 1 from public.at_dispatch_requests where organization_id=current_setting('qa.hub_org')::uuid and status='queued') then raise exception 'Staging driver or queue is in use; abort isolated QA';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.hub_customer'),'role','authenticated')::text,true);
set local role authenticated;
select public.at_save_hub_policy(current_setting('qa.hub_org')::uuid,true,'QA Logistics',2500,200,1000,500,5000,8000,4000,44000);
reset role;
-- Temporarily remove the existing admin's membership inside this rollback-only transaction,
-- so the same verified identity exercises actual customer-only RLS and RPC permissions.
delete from public.at_organization_members where organization_id=current_setting('qa.hub_org')::uuid and user_id=current_setting('qa.hub_customer')::uuid;
set local role authenticated;
select set_config('qa.hub_nonce',gen_random_uuid()::text,true);
select set_config('qa.hub_request',public.at_submit_customer_request(current_setting('qa.hub_org')::uuid,'freight','QA Warehouse','QA Destination','Four QA pallets',4,4200,65,now()+interval '1 day',now()+interval '26 hours','priority',current_setting('qa.hub_nonce')::uuid)::text,true);
do $$declare r public.at_customer_requests;again uuid;begin
 select * into r from public.at_customer_requests where id=current_setting('qa.hub_request')::uuid;
 if (r.quote->>'total_cents')::integer<>27500 or (r.quote->>'driver_cents')::integer<>22000 then raise exception 'Server quote disagrees with expected breakdown';end if;
 again:=public.at_submit_customer_request(current_setting('qa.hub_org')::uuid,'freight','QA Warehouse','QA Destination','Four QA pallets',4,4200,65,now()+interval '1 day',now()+interval '26 hours','priority',current_setting('qa.hub_nonce')::uuid);
 if again<>r.id then raise exception 'Submit retry created duplicate shipment';end if;
 begin perform public.at_review_customer_quote(r.id,70);raise exception 'Customer reviewed own quote' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin perform public.at_accept_customer_quote(r.id,27500);raise exception 'Unreviewed quote was bookable' using errcode='XX000';exception when invalid_parameter_value then null;end;
 begin update public.at_customer_requests set quote='{}' where id=r.id;raise exception 'Customer tampered with price' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.at_organization_members(organization_id,user_id,role) values(current_setting('qa.hub_org')::uuid,current_setting('qa.hub_customer')::uuid,'admin');
set local role authenticated;
select public.at_review_customer_quote(current_setting('qa.hub_request')::uuid,70);
do $$begin
 begin perform public.at_accept_customer_quote(current_setting('qa.hub_request')::uuid,27500);raise exception 'Stale quote amount accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
end $$;
select set_config('qa.hub_job',public.at_accept_customer_quote(current_setting('qa.hub_request')::uuid,28750)::text,true);
do $$begin
 if public.at_accept_customer_quote(current_setting('qa.hub_request')::uuid,28750)<>current_setting('qa.hub_job')::uuid then raise exception 'Booking retry duplicated assignment';end if;
end $$;
reset role;
update public.at_driver_profiles set license_class='A',license_verified=true,availability='available' where organization_id=current_setting('qa.hub_org')::uuid and user_id=current_setting('qa.hub_driver')::uuid;
insert into public.at_vehicles(organization_id,unit_number,vehicle_type,required_license_class,payload_capacity_lbs,enabled) values(current_setting('qa.hub_org')::uuid,'QA-HUB-LOW','tractor','A',2000,true),(current_setting('qa.hub_org')::uuid,'QA-HUB-HIGH','tractor','A',10000,true);
set local role authenticated;
select public.at_set_driver_service_access(current_setting('qa.hub_org')::uuid,current_setting('qa.hub_driver')::uuid,'freight',true,'Rollback-only synthetic qualification');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.hub_driver'),'role','authenticated')::text,true);
select set_config('qa.hub_token',public.at_begin_driver_tracking(current_setting('qa.hub_org')::uuid)::text,true);
select public.at_publish_driver_location(current_setting('qa.hub_org')::uuid,current_setting('qa.hub_token')::uuid,32.75,-97.33,8,clock_timestamp(),0,0);
select public.at_set_driver_online(current_setting('qa.hub_org')::uuid,true,current_setting('qa.hub_token')::uuid);
select public.at_join_driver_queue(current_setting('qa.hub_org')::uuid,'freight');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.hub_customer'),'role','authenticated')::text,true);
do $$begin
 begin perform public.at_offer_assignment(current_setting('qa.hub_job')::uuid,current_setting('qa.hub_driver')::uuid,(select id from public.at_vehicles where unit_number='QA-HUB-LOW'));raise exception 'Overweight equipment was offered' using errcode='XX000';exception when check_violation then null;end;
 perform public.at_offer_assignment(current_setting('qa.hub_job')::uuid,current_setting('qa.hub_driver')::uuid,(select id from public.at_vehicles where unit_number='QA-HUB-HIGH'));
 if public.at_customer_shipment_status(current_setting('qa.hub_request')::uuid)->'gps'<>'null'::jsonb then raise exception 'GPS visible before transit';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.hub_driver'),'role','authenticated')::text,true);
select public.at_respond_assignment(current_setting('qa.hub_job')::uuid,true);
select public.at_advance_assignment(current_setting('qa.hub_job')::uuid,'at_pickup');
select public.at_advance_assignment(current_setting('qa.hub_job')::uuid,'picked_up');
select public.at_advance_assignment(current_setting('qa.hub_job')::uuid,'in_transit');
do $$begin if public.at_customer_shipment_status(current_setting('qa.hub_request')::uuid)->'gps'<>'null'::jsonb then raise exception 'Dispatch-only GPS leaked without customer consent';end if;end $$;
select public.at_consent_customer_tracking(current_setting('qa.hub_org')::uuid,current_setting('qa.hub_token')::uuid);
insert into public.at_shipment_messages(request_id,body,client_nonce) values(current_setting('qa.hub_request')::uuid,'QA driver shipment message',gen_random_uuid());
do $$begin
 begin perform public.at_confirm_delivery(current_setting('qa.hub_job')::uuid,'QA Recipient','missing-photo','');raise exception 'Delivery without photo succeeded' using errcode='XX000';exception when raise_exception then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.hub_customer'),'role','authenticated')::text,true);
reset role;
delete from public.at_organization_members where organization_id=current_setting('qa.hub_org')::uuid and user_id=current_setting('qa.hub_customer')::uuid;
set local role authenticated;
do $$begin
 if (public.at_customer_shipment_status(current_setting('qa.hub_request')::uuid)->'gps'->>'latitude')::numeric<>32.75 then raise exception 'Customer cannot see fresh in-transit position';end if;
 if not exists(select 1 from public.at_shipment_messages where body='QA driver shipment message') then raise exception 'Customer cannot read assigned-driver message';end if;
end $$;
insert into public.at_shipment_messages(request_id,body,client_nonce) values(current_setting('qa.hub_request')::uuid,'QA customer shipment message',gen_random_uuid());
reset role;
select set_config('qa.hub_photo',current_setting('qa.hub_org')||'/'||current_setting('qa.hub_job')||'/'||current_setting('qa.hub_driver')||'/'||gen_random_uuid()::text||'.jpg',true);
insert into storage.objects(bucket_id,name,metadata) values('at-delivery-evidence',current_setting('qa.hub_photo'),'{"mimetype":"image/jpeg","size":128}');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.hub_driver'),'role','authenticated')::text,true);
set local role authenticated;
select public.at_confirm_delivery(current_setting('qa.hub_job')::uuid,'QA Recipient',current_setting('qa.hub_photo'),'Synthetic metadata only. No actual photo uploaded.');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.hub_customer'),'role','authenticated')::text,true);
do $$declare s jsonb;begin
 s:=public.at_customer_shipment_status(current_setting('qa.hub_request')::uuid);
 if s->>'status'<>'delivered' or s->'gps'<>'null'::jsonb or s->'proof'->>'evidence_path'<>current_setting('qa.hub_photo') then raise exception 'Tracking did not end with photo-backed delivery';end if;
 if not exists(select 1 from storage.objects where name=current_setting('qa.hub_photo')) then raise exception 'Customer cannot read own confirmed photo metadata';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
do $$begin
 if exists(select 1 from public.at_customer_requests) or exists(select 1 from public.at_shipment_messages) then raise exception 'Unrelated customer can read shipments or messages';end if;
 if exists(select 1 from storage.objects where name=current_setting('qa.hub_photo')) then raise exception 'Unrelated customer sees evidence';end if;
 begin perform public.at_customer_shipment_status(current_setting('qa.hub_request')::uuid);raise exception 'Unrelated customer accessed GPS' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform public.at_customer_shipment_status(current_setting('qa.hub_request')::uuid);raise exception 'Anonymous tracking accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: request, server quote, review/approval, payload matching, driver acceptance, participant messages, temporary GPS, photo requirement, delivery cutoff and tenant isolation; all fixtures rolled back' as result;
