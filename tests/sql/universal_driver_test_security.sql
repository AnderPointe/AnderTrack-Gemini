begin;
select set_config('request.jwt.claims', json_build_object('sub',(select user_id from public.at_driver_profiles where display_name='AnderTrack Staging Driver' limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $test$
declare j public.at_driver_test_jobs; affected integer; n integer;
begin
  select * into strict j from public.at_driver_test_jobs where service_id='food';
  if j.status<>'offered' then raise exception 'Fixture not in initial state'; end if;
  begin
    update public.at_driver_test_jobs set status='completed' where id=j.id;
    raise exception 'Skipped transition allowed';
  exception when check_violation then null; end;
  update public.at_driver_test_jobs set status='accepted' where id=j.id and revision=j.revision;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Valid transition failed'; end if;
  update public.at_driver_test_jobs set status='at_pickup' where id=j.id and revision=j.revision;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Stale revision accepted'; end if;
  select count(*) into n from public.at_driver_test_job_events where job_id=j.id and previous_status='offered' and next_status='accepted';
  if n<>1 then raise exception 'Audit event missing'; end if;
  begin
    update public.at_driver_test_jobs set estimated_cents=99999 where id=j.id;
    raise exception 'Protected column editable';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.at_driver_test_job_events(job_id,previous_status,next_status,revision,actor_user_id) values(j.id,'accepted','completed',99,auth.uid());
    raise exception 'Audit forgery allowed';
  exception when insufficient_privilege then null; end;
  insert into public.at_driver_test_preferences(organization_id,user_id,service_id,online)
  values(j.organization_id,auth.uid(),'food',true)
  on conflict(organization_id,user_id) do update set service_id='food',online=true;
end $test$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $test$ begin
  if exists(select 1 from public.at_driver_test_jobs) then raise exception 'Cross-driver read allowed'; end if;
  if exists(select 1 from public.at_driver_test_preferences) then raise exception 'Cross-driver preference read allowed'; end if;
  if exists(select 1 from public.at_driver_test_job_events) then raise exception 'Cross-driver audit read allowed'; end if;
end $test$;
set local role anon;
do $test$ begin
  begin perform 1 from public.at_driver_test_jobs; raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
end $test$;
rollback;
select 'PASS: valid progress, stale revision protection, skipped-step denial, protected fields, immutable audit, preferences, cross-driver isolation, anonymous denial. All writes rolled back.' as result;
