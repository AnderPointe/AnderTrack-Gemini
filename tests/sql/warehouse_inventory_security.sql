-- Staging only: isolated SQL role fixtures, entirely rolled back; no real signup.
begin;
set local statement_timeout='25s';
select set_config('qa.inv_org',gen_random_uuid()::text,true),set_config('qa.inv_other',gen_random_uuid()::text,true),set_config('qa.inv_admin',gen_random_uuid()::text,true),set_config('qa.inv_driver',gen_random_uuid()::text,true);
insert into auth.users(instance_id,id,aud,role,email,created_at,updated_at) select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated','inventory-'||id||'@example.invalid',now(),now() from(values(current_setting('qa.inv_admin')::uuid),(current_setting('qa.inv_driver')::uuid))x(id);
insert into public.at_organizations(id,name) values(current_setting('qa.inv_org')::uuid,'Rollback warehouse A'),(current_setting('qa.inv_other')::uuid,'Rollback warehouse B');
insert into public.at_organization_members(organization_id,user_id,role) values(current_setting('qa.inv_org')::uuid,current_setting('qa.inv_admin')::uuid,'admin'),(current_setting('qa.inv_org')::uuid,current_setting('qa.inv_driver')::uuid,'driver');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.inv_admin'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('qa.inv_item',public.at_create_inventory_item(current_setting('qa.inv_org')::uuid,'Test-sku','Audit cases','case',8)::text,true);
select set_config('qa.inv_a',public.at_create_warehouse_location(current_setting('qa.inv_org')::uuid,'A-01','Receiving bay')::text,true);
select set_config('qa.inv_b',public.at_create_warehouse_location(current_setting('qa.inv_org')::uuid,'B-02','Storage rack')::text,true);
select set_config('qa.inv_nonce',gen_random_uuid()::text,true);
do $$declare org uuid:=current_setting('qa.inv_org')::uuid;item uuid:=current_setting('qa.inv_item')::uuid;a uuid:=current_setting('qa.inv_a')::uuid;b uuid:=current_setting('qa.inv_b')::uuid;nonce uuid:=current_setting('qa.inv_nonce')::uuid;r jsonb;again jsonb;begin
 if public.at_create_inventory_item(org,'TEST-SKU','Audit cases','case',8)<>item then raise exception 'Duplicate item retry';end if;
 if public.at_create_warehouse_location(org,'A-01','Receiving bay')<>a then raise exception 'Duplicate location retry';end if;
 begin perform public.at_create_inventory_item(org,'TEST-SKU','Wrong name','case',8);raise exception 'Mismatched SKU accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
 r:=public.at_record_inventory_movement(org,item,a,'receive',10,'Receive QA shipment',nonce);
 again:=public.at_record_inventory_movement(org,item,a,'receive',10,'Receive QA shipment',nonce);
 if r->>'id'<>again->>'id' or again->>'replayed'<>'true' then raise exception 'Retry was not idempotent';end if;
 begin perform public.at_record_inventory_movement(org,item,a,'receive',11,'Receive QA shipment',nonce);raise exception 'Nonce tampering accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
 perform public.at_record_inventory_movement(org,item,a,'transfer',4,'Transfer to audit rack',gen_random_uuid(),b);
 perform public.at_record_inventory_movement(org,item,b,'issue',3,'Issue three audit cases',gen_random_uuid());
 if (select quantity from public.at_inventory_balances where item_id=item and location_id=a)<>6 or (select quantity from public.at_inventory_balances where item_id=item and location_id=b)<>1 then raise exception 'Balances incorrect';end if;
 if (select sum(quantity) from public.at_inventory_balances where item_id=item)<>7 then raise exception 'Transfer changed total stock';end if;
 if (select count(*) from public.at_inventory_movements where item_id=item)<>3 then raise exception 'Ledger not append-only/idempotent';end if;
 begin perform public.at_record_inventory_movement(org,item,b,'issue',100,'Invalid excess issue',gen_random_uuid());raise exception 'Negative stock accepted' using errcode='XX000';exception when check_violation then null;end;
 begin perform public.at_record_inventory_movement(org,item,a,'receive',1.0001,'Precision overflow',gen_random_uuid());raise exception 'Invalid precision accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
 begin perform public.at_record_inventory_movement(org,item,a,'transfer',1,'Same location transfer',gen_random_uuid(),a);raise exception 'Self transfer accepted' using errcode='XX000';exception when invalid_parameter_value then null;end;
 begin update public.at_inventory_balances set quantity=999 where item_id=item;raise exception 'Direct stock tampering accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin delete from public.at_inventory_movements where item_id=item;raise exception 'Ledger deletion accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin perform public.at_create_inventory_item(current_setting('qa.inv_other')::uuid,'BAD','Cross company','each',1);raise exception 'Cross company write accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into public.at_warehouse_locations(organization_id,code,name,created_by) values(current_setting('qa.inv_other')::uuid,'FOREIGN','Foreign warehouse',current_setting('qa.inv_admin')::uuid);
select set_config('qa.inv_foreign_location',(select id::text from public.at_warehouse_locations where organization_id=current_setting('qa.inv_other')::uuid),true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.at_warehouse_locations where organization_id=current_setting('qa.inv_other')::uuid) then raise exception 'Foreign location leaked';end if;
 begin perform public.at_record_inventory_movement(current_setting('qa.inv_org')::uuid,current_setting('qa.inv_item')::uuid,current_setting('qa.inv_a')::uuid,'transfer',1,'Invalid foreign transfer',gen_random_uuid(),current_setting('qa.inv_foreign_location')::uuid);raise exception 'Cross tenant transfer accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.inv_driver'),'role','authenticated')::text,true);
do $$begin
 if exists(select 1 from public.at_inventory_items) or exists(select 1 from public.at_inventory_balances) or exists(select 1 from public.at_inventory_movements) then raise exception 'Driver sees warehouse stock';end if;
 begin perform public.at_record_inventory_movement(current_setting('qa.inv_org')::uuid,current_setting('qa.inv_item')::uuid,current_setting('qa.inv_a')::uuid,'receive',1,'Unauthorized driver receipt',gen_random_uuid());raise exception 'Driver changed inventory' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$begin
 begin perform count(*) from public.at_inventory_items;raise exception 'Anon inventory read accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
 begin perform public.at_create_warehouse_location(current_setting('qa.inv_org')::uuid,'BAD','Anonymous location');raise exception 'Anon RPC accepted' using errcode='XX000';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: receive/issue/transfer balances, conserved stock, idempotent retries, precision/input guards, negative-stock refusal, immutable ledger, RLS/cross-tenant/driver/anonymous denial; all fixtures rolled back' as result;
