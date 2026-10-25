-- Rollback-only QA against Andertrack Staging. Uses existing accounts, not new Auth users.
begin;
select set_config('qa.org',(select organization_id::text from public.at_driver_profiles where display_name='AnderTrack Staging Driver' limit 1),true);
select set_config('qa.driver',(select user_id::text from public.at_driver_profiles where display_name='AnderTrack Staging Driver' limit 1),true);
select set_config('qa.admin',(select user_id::text from public.at_organization_members where organization_id=current_setting('qa.org')::uuid and role='admin' limit 1),true);
do $$begin
  if current_setting('qa.driver',true) is null or current_setting('qa.admin',true) is null then raise exception 'Named staging accounts are required'; end if;
  if exists(select 1 from public.at_dispatch_requests where organization_id=current_setting('qa.org')::uuid and status='queued') then raise exception 'Staging queue is in use; run isolated QA later'; end if;
  if exists(select 1 from public.at_assignments where driver_user_id=current_setting('qa.driver')::uuid and status in ('offered','assigned','accepted','at_pickup','picked_up','in_transit')) then raise exception 'Staging driver has an active assignment; do not alter it'; end if;
end $$;
update public.at_driver_profiles set license_verified=true,license_class='A',availability='available' where organization_id=current_setting('qa.org')::uuid and user_id=current_setting('qa.driver')::uuid;
insert into public.at_driver_profiles(organization_id,user_id,display_name,license_class,license_verified,availability)
values(current_setting('qa.org')::uuid,current_setting('qa.admin')::uuid,'QA Peer Driver','C',true,'available');
insert into public.at_dispatch_requests(organization_id,driver_user_id) values(current_setting('qa.org')::uuid,current_setting('qa.admin')::uuid);
insert into public.at_vehicles(organization_id,unit_number,vehicle_type,required_license_class,enabled)
values(current_setting('qa.org')::uuid,'QA-CONNECTED-A','tractor','A',true),(current_setting('qa.org')::uuid,'QA-CONNECTED-C','car','C',true);

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare service text; begin
  begin perform public.at_begin_driver_tracking(current_setting('qa.org')::uuid);raise exception 'Dispatcher published driver GPS' using errcode='XX000';exception when insufficient_privilege then null;end;
  foreach service in array array['freight','otr','courier','food','rideshare','waste'] loop
    perform public.at_set_driver_service_access(current_setting('qa.org')::uuid,current_setting('qa.driver')::uuid,service,true,'Rollback-only QA: synthetic qualification review.');
    perform public.at_create_service_assignment(current_setting('qa.org')::uuid,service,'QA-CONNECTED-'||service,'QA Customer','Synthetic task only','QA Pickup','QA Destination',10);
  end loop;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.driver'),'role','authenticated')::text,true);
do $$begin
  begin perform public.at_create_service_assignment(current_setting('qa.org')::uuid,'courier','BAD-TASK','QA Customer','Synthetic task','QA Pickup','QA Destination',10);raise exception 'Driver created dispatch task' using errcode='XX000';exception when insufficient_privilege then null;end;
  begin perform public.at_set_driver_service_access(current_setting('qa.org')::uuid,current_setting('qa.driver')::uuid,'courier',true,'Attempted self approval');raise exception 'Driver approved own service' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
select set_config('qa.token',public.at_begin_driver_tracking(current_setting('qa.org')::uuid)::text,true);
do $$begin
  begin perform public.at_request_dispatch(current_setting('qa.org')::uuid);raise exception 'Legacy queue bypassed location gate' using errcode='XX000';exception when check_violation then null;end;
  begin perform public.at_set_driver_online(current_setting('qa.org')::uuid,true,current_setting('qa.token')::uuid);raise exception 'Online without GPS was allowed' using errcode='XX000';exception when check_violation then null;end;
  begin perform public.at_publish_driver_location(current_setting('qa.org')::uuid,current_setting('qa.token')::uuid,999,-97.33,8,clock_timestamp(),null,null);raise exception 'Invalid GPS accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
end $$;
select public.at_publish_driver_location(current_setting('qa.org')::uuid,current_setting('qa.token')::uuid,32.75,-97.33,8,clock_timestamp(),0,0);
select public.at_set_driver_online(current_setting('qa.org')::uuid,true,current_setting('qa.token')::uuid);
select public.at_join_driver_queue(current_setting('qa.org')::uuid,'courier');
do $$declare n integer; pos bigint; begin
  select count(*) into n from public.at_driver_queue_snapshot(current_setting('qa.org')::uuid);
  if n<>2 then raise exception 'Driver cannot see the full organization queue';end if;
  select queue_position into pos from public.at_driver_queue_snapshot(current_setting('qa.org')::uuid) where driver_user_id=auth.uid();
  if pos<>2 then raise exception 'FIFO position incorrect';end if;
  insert into public.at_dispatch_messages(organization_id,driver_user_id,body,client_nonce) values(current_setting('qa.org')::uuid,auth.uid(),'QA connected driver to dispatch',gen_random_uuid());
  begin insert into public.at_dispatch_messages(organization_id,driver_user_id,sender_user_id,body,client_nonce) values(current_setting('qa.org')::uuid,auth.uid(),current_setting('qa.admin')::uuid,'QA spoof',gen_random_uuid());raise exception 'Sender spoof allowed' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.admin'),'role','authenticated')::text,true);
do $$declare job uuid; vehicle uuid; begin
  if not exists(select 1 from public.at_dispatch_messages where body='QA connected driver to dispatch') then raise exception 'Website cannot read app message';end if;
  insert into public.at_dispatch_messages(organization_id,driver_user_id,body,client_nonce) values(current_setting('qa.org')::uuid,current_setting('qa.driver')::uuid,'QA connected dispatch to driver',gen_random_uuid());
  if not exists(select 1 from public.at_live_driver_locations where driver_user_id=current_setting('qa.driver')::uuid and online and latitude=32.75) then raise exception 'Website cannot read driver tracking';end if;
  select id into job from public.at_assignments where reference='QA-CONNECTED-courier' and organization_id=current_setting('qa.org')::uuid;
  select id into vehicle from public.at_vehicles where unit_number='QA-CONNECTED-C' and organization_id=current_setting('qa.org')::uuid;
  begin perform public.at_claim_next_dispatch(current_setting('qa.org')::uuid,job,vehicle);raise exception 'Skipped ineligible FIFO head' using errcode='XX000';exception when raise_exception then null;end;
end $$;
reset role;
update public.at_dispatch_requests set status='cancelled',handled_by=driver_user_id,handled_at=clock_timestamp() where organization_id=current_setting('qa.org')::uuid and driver_user_id=current_setting('qa.admin')::uuid and status='queued';
set local role authenticated;
do $$declare job uuid; vehicle uuid; begin
  select id into job from public.at_assignments where reference='QA-CONNECTED-courier' and organization_id=current_setting('qa.org')::uuid;
  select id into vehicle from public.at_vehicles where unit_number='QA-CONNECTED-C' and organization_id=current_setting('qa.org')::uuid;
  perform public.at_claim_next_dispatch(current_setting('qa.org')::uuid,job,vehicle);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.driver'),'role','authenticated')::text,true);
do $$declare job uuid; begin
  if not exists(select 1 from public.at_dispatch_messages where body='QA connected dispatch to driver') then raise exception 'App cannot read website reply';end if;
  select id into job from public.at_assignments where reference='QA-CONNECTED-courier';
  if job is null then raise exception 'App did not receive task offer';end if;
  perform public.at_respond_assignment(job,false);
  begin update public.at_dispatch_messages set body='Forged edit';raise exception 'Message edits allowed' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;

-- Every service can be queued and offered through the same website/app contract.
do $$declare service text; job uuid; vehicle uuid; begin
  foreach service in array array['freight','otr','courier','food','rideshare','waste'] loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.driver'),'role','authenticated')::text,true);
    perform public.at_join_driver_queue(current_setting('qa.org')::uuid,service);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.admin'),'role','authenticated')::text,true);
    select id into job from public.at_assignments where reference='QA-CONNECTED-'||service and organization_id=current_setting('qa.org')::uuid;
    select id into vehicle from public.at_vehicles where unit_number=case when service in ('freight','otr') then 'QA-CONNECTED-A' else 'QA-CONNECTED-C' end and organization_id=current_setting('qa.org')::uuid;
    perform public.at_claim_next_dispatch(current_setting('qa.org')::uuid,job,vehicle);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.driver'),'role','authenticated')::text,true);
    if not exists(select 1 from public.at_assignments where id=job and status='offered') then raise exception 'Offer not visible in app';end if;
    perform public.at_respond_assignment(job,false);
  end loop;
end $$;

-- Collection equipment must match the declared Class B requirement.
reset role;
insert into public.at_vehicles(organization_id,unit_number,vehicle_type,required_license_class,enabled)
values(current_setting('qa.org')::uuid,'QA-CONNECTED-B','other','B',true);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.admin'),'role','authenticated')::text,true);
select public.at_create_service_task(current_setting('qa.org')::uuid,'waste','QA-CONNECTED-WASTE-B','QA Customer','Synthetic collection task','QA Pickup','QA Disposal',10,'B');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.driver'),'role','authenticated')::text,true);
select public.at_join_driver_queue(current_setting('qa.org')::uuid,'waste');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.admin'),'role','authenticated')::text,true);
do $$declare job uuid; wrong_vehicle uuid; right_vehicle uuid; begin
  select id into job from public.at_assignments where reference='QA-CONNECTED-WASTE-B';
  select id into wrong_vehicle from public.at_vehicles where unit_number='QA-CONNECTED-A';
  select id into right_vehicle from public.at_vehicles where unit_number='QA-CONNECTED-B';
  begin perform public.at_claim_next_dispatch(current_setting('qa.org')::uuid,job,wrong_vehicle);raise exception 'Wrong equipment class accepted' using errcode='XX000';exception when raise_exception then null;end;
  perform public.at_claim_next_dispatch(current_setting('qa.org')::uuid,job,right_vehicle);
  if exists(select 1 from public.at_dispatch_requests where organization_id=current_setting('qa.org')::uuid and driver_user_id=current_setting('qa.driver')::uuid and status='queued') then raise exception 'Matched request left waiting';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.driver'),'role','authenticated')::text,true);
select public.at_respond_assignment((select id from public.at_assignments where reference='QA-CONNECTED-WASTE-B'),false);

reset role;
select set_config('qa.other_org',gen_random_uuid()::text,true);
insert into public.at_organizations(id,name) values(current_setting('qa.other_org')::uuid,'QA Isolated Organization');
insert into public.at_driver_profiles(organization_id,user_id,display_name,license_class) values(current_setting('qa.other_org')::uuid,current_setting('qa.driver')::uuid,'QA Private Driver','C');
insert into public.at_dispatch_messages(organization_id,driver_user_id,sender_user_id,body,client_nonce) values(current_setting('qa.other_org')::uuid,current_setting('qa.driver')::uuid,current_setting('qa.admin')::uuid,'QA private other organization',gen_random_uuid());
insert into public.at_dispatch_messages(organization_id,driver_user_id,sender_user_id,body,client_nonce) values(current_setting('qa.org')::uuid,current_setting('qa.admin')::uuid,current_setting('qa.admin')::uuid,'QA private peer thread',gen_random_uuid());
set local role authenticated;
do $$begin
  if exists(select 1 from public.at_dispatch_messages where body in ('QA private other organization','QA private peer thread')) then raise exception 'Driver privacy isolation failed';end if;
  begin perform public.at_driver_queue_snapshot(current_setting('qa.other_org')::uuid);raise exception 'Cross-organization queue allowed' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
select public.at_set_driver_online(current_setting('qa.org')::uuid,false,current_setting('qa.token')::uuid);
do $$begin
  if exists(select 1 from public.at_live_driver_locations where driver_user_id=auth.uid() and (sharing or online or latitude is not null or longitude is not null)) then raise exception 'Coordinates retained after stop';end if;
  begin perform public.at_publish_driver_location(current_setting('qa.org')::uuid,current_setting('qa.token')::uuid,32.75,-97.33,8,clock_timestamp(),null,null);raise exception 'Late GPS reactivated tracking' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
set local role anon;
do $$begin
  begin perform 1 from public.at_dispatch_messages;raise exception 'Anonymous message read allowed' using errcode='XX000';exception when insufficient_privilege then null;end;
  begin perform public.at_driver_queue_snapshot(current_setting('qa.org')::uuid);raise exception 'Anonymous queue allowed' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'PASS: driver-to-website message and dispatch reply; driver GPS visible to website; location required online; all six service offers visible to driver; full FIFO queue visible; sender forgery, cross-thread, cross-org, anonymous access and late GPS denied. All fixtures and changes rolled back.' as result;
