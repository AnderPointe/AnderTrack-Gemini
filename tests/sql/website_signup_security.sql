-- Rollback-only staging tests. Reuses existing verified identities; creates no Auth users.
begin;
select set_config('qa.signup_driver',(select user_id::text from public.at_driver_profiles where display_name='AnderTrack Staging Driver' limit 1),true);
select set_config('qa.signup_admin',(select user_id::text from public.at_organization_members where role='admin' order by created_at limit 1),true);
do $$begin
 if current_setting('qa.signup_driver',true) is null or current_setting('qa.signup_admin',true) is null then raise exception 'Staging test identities unavailable';end if;
 if exists(select 1 from public.at_platform_accounts where user_id in (current_setting('qa.signup_driver')::uuid,current_setting('qa.signup_admin')::uuid)) then raise exception 'Existing accounts are in use; do not overwrite';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.signup_driver'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare result jsonb; old_count integer; begin
 select count(*) into old_count from public.at_organization_members where user_id=auth.uid();
 begin perform public.at_complete_platform_signup('X','individual',null);raise exception 'Invalid name accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
 result:=public.at_complete_platform_signup('QA Individual','individual',null);
 if result->>'account_kind'<>'individual' or result->>'organization_id' is not null then raise exception 'Individual gained company access';end if;
 if (select count(*) from public.at_organization_members where user_id=auth.uid())<>old_count then raise exception 'Individual added a membership';end if;
 if (select count(*) from public.at_platform_accounts)<>1 then raise exception 'Own account unavailable';end if;
 begin update public.at_platform_accounts set account_kind='company' where user_id=auth.uid();raise exception 'Direct account update accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin insert into public.at_platform_accounts(user_id,display_name,account_kind) values(auth.uid(),'Forged','individual');raise exception 'Direct insert accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.signup_admin'),'role','authenticated')::text,true);
do $$declare result jsonb; repeated jsonb; created uuid; begin
 if exists(select 1 from public.at_platform_accounts) then raise exception 'Another user account is visible';end if;
 begin perform public.at_complete_platform_signup('QA Company','admin','Anything');raise exception 'Role accepted as account type' using errcode='XX000';exception when invalid_parameter_value then null;end;
 result:=public.at_complete_platform_signup('QA Founder','company','QA Isolated Signup Company');created:=(result->>'organization_id')::uuid;
 if created is null then raise exception 'Company not created';end if;
 if not exists(select 1 from public.at_organization_members where organization_id=created and user_id=auth.uid() and role='admin') then raise exception 'Founder cannot access new workspace';end if;
 if exists(select 1 from public.at_organization_members where organization_id=created and user_id<>auth.uid()) then raise exception 'Another user was added to new company';end if;
 repeated:=public.at_complete_platform_signup('Different name','company','Different company');
 if repeated->>'organization_id'<>created::text then raise exception 'Retry created an extra tenant';end if;
 if (select count(*) from public.at_platform_accounts)<>1 then raise exception 'Accounts are not isolated';end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$begin
 begin perform public.at_complete_platform_signup('Anon User','individual',null);raise exception 'Anonymous signup completion accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin perform count(*) from public.at_platform_accounts;raise exception 'Anonymous read accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: isolated individual/company accounts, idempotent company creation, RLS and permission checks; all fixtures rolled back' as result;
