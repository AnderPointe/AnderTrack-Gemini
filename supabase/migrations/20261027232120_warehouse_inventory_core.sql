-- Staging warehouse foundation. All stock writes go through authenticated planner RPCs.
create table public.at_inventory_items(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.at_organizations(id),
 sku text not null check(length(sku) between 1 and 64 and sku=upper(btrim(sku))),name text not null check(length(btrim(name)) between 2 and 160),
 unit text not null check(unit in ('each','case','pallet','kg','lb')),reorder_point numeric(15,3) not null default 0 check(reorder_point between 0 and 1000000000),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,sku),unique(organization_id,id)
);
create table public.at_warehouse_locations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.at_organizations(id),
 code text not null check(length(code) between 1 and 64 and code=upper(btrim(code))),name text not null check(length(btrim(name)) between 2 and 160),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(organization_id,code),unique(organization_id,id)
);
create table public.at_inventory_balances(
 organization_id uuid not null,item_id uuid not null,location_id uuid not null,quantity numeric(15,3) not null default 0 check(quantity between 0 and 1000000000),updated_at timestamptz not null default now(),
 primary key(organization_id,item_id,location_id),foreign key(organization_id,item_id) references public.at_inventory_items(organization_id,id),foreign key(organization_id,location_id) references public.at_warehouse_locations(organization_id,id)
);
create index inventory_balance_location on public.at_inventory_balances(organization_id,location_id);
create table public.at_inventory_movements(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,item_id uuid not null,location_id uuid not null,to_location_id uuid,
 operation text not null check(operation in ('receive','issue','transfer')),quantity numeric(15,3) not null check(quantity>0 and quantity<=1000000000),
 before_quantity numeric(15,3) not null,after_quantity numeric(15,3) not null,to_before_quantity numeric(15,3),to_after_quantity numeric(15,3),
 note text not null check(length(btrim(note)) between 6 and 500),actor_user_id uuid not null references auth.users(id),client_nonce uuid not null,occurred_at timestamptz not null default now(),
 unique(organization_id,client_nonce),foreign key(organization_id,item_id) references public.at_inventory_items(organization_id,id),foreign key(organization_id,location_id) references public.at_warehouse_locations(organization_id,id),foreign key(organization_id,to_location_id) references public.at_warehouse_locations(organization_id,id),
 check((operation='transfer' and to_location_id is not null and to_location_id<>location_id) or (operation<>'transfer' and to_location_id is null))
);
create index inventory_movements_history on public.at_inventory_movements(organization_id,occurred_at desc,id);
create index inventory_movements_item on public.at_inventory_movements(organization_id,item_id);
create index inventory_movements_location on public.at_inventory_movements(organization_id,location_id);
create index inventory_movements_destination on public.at_inventory_movements(organization_id,to_location_id) where to_location_id is not null;
create index inventory_movements_actor on public.at_inventory_movements(actor_user_id);
create index inventory_items_creator on public.at_inventory_items(created_by);
create index warehouse_locations_creator on public.at_warehouse_locations(created_by);
alter table public.at_inventory_items enable row level security;
alter table public.at_warehouse_locations enable row level security;
alter table public.at_inventory_balances enable row level security;
alter table public.at_inventory_movements enable row level security;
revoke all on public.at_inventory_items,public.at_warehouse_locations,public.at_inventory_balances,public.at_inventory_movements from anon,authenticated;
grant select on public.at_inventory_items,public.at_warehouse_locations,public.at_inventory_balances,public.at_inventory_movements to authenticated;
create policy inventory_items_planner_read on public.at_inventory_items for select to authenticated using(exists(select 1 from public.at_organization_members m where m.organization_id=at_inventory_items.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','dispatcher')));
create policy warehouse_locations_planner_read on public.at_warehouse_locations for select to authenticated using(exists(select 1 from public.at_organization_members m where m.organization_id=at_warehouse_locations.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','dispatcher')));
create policy inventory_balances_planner_read on public.at_inventory_balances for select to authenticated using(exists(select 1 from public.at_organization_members m where m.organization_id=at_inventory_balances.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','dispatcher')));
create policy inventory_movements_planner_read on public.at_inventory_movements for select to authenticated using(exists(select 1 from public.at_organization_members m where m.organization_id=at_inventory_movements.organization_id and m.user_id=(select auth.uid()) and m.role in ('admin','dispatcher')));

create function at_private.create_inventory_item(p_organization_id uuid,p_sku text,p_name text,p_unit text,p_reorder_point numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();result uuid;existing public.at_inventory_items;begin
 if actor is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=actor and role in ('admin','dispatcher')) then raise exception 'Warehouse planner access required' using errcode='42501';end if;
 if p_sku is null or length(btrim(p_sku)) not between 1 and 64 or p_name is null or length(btrim(p_name)) not between 2 and 160 or p_unit is null or p_unit not in ('each','case','pallet','kg','lb') or p_reorder_point is null or not(p_reorder_point between 0 and 1000000000) or p_reorder_point<>trunc(p_reorder_point,3) then raise exception 'Valid SKU, name, unit and reorder point are required' using errcode='22023';end if;
 insert into public.at_inventory_items(organization_id,sku,name,unit,reorder_point,created_by) values(p_organization_id,upper(btrim(p_sku)),btrim(p_name),p_unit,p_reorder_point,actor) on conflict(organization_id,sku) do nothing returning id into result;
 if result is null then select * into existing from public.at_inventory_items where organization_id=p_organization_id and sku=upper(btrim(p_sku));if existing.name<>btrim(p_name) or existing.unit<>p_unit or existing.reorder_point<>p_reorder_point then raise exception 'SKU already exists with different settings' using errcode='22023';end if;result:=existing.id;end if;
 return result;end $$;
create function at_private.create_warehouse_location(p_organization_id uuid,p_code text,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();result uuid;existing public.at_warehouse_locations;begin
 if actor is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=actor and role in ('admin','dispatcher')) then raise exception 'Warehouse planner access required' using errcode='42501';end if;
 if p_code is null or length(btrim(p_code)) not between 1 and 64 or p_name is null or length(btrim(p_name)) not between 2 and 160 then raise exception 'Valid location code and name are required' using errcode='22023';end if;
 insert into public.at_warehouse_locations(organization_id,code,name,created_by) values(p_organization_id,upper(btrim(p_code)),btrim(p_name),actor) on conflict(organization_id,code) do nothing returning id into result;
 if result is null then select * into existing from public.at_warehouse_locations where organization_id=p_organization_id and code=upper(btrim(p_code));if existing.name<>btrim(p_name) then raise exception 'Location code already exists with a different name' using errcode='22023';end if;result:=existing.id;end if;
 return result;end $$;
create function at_private.record_inventory_movement(p_organization_id uuid,p_item_id uuid,p_location_id uuid,p_operation text,p_quantity numeric,p_note text,p_nonce uuid,p_to_location_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();prior public.at_inventory_movements;before_qty numeric;after_qty numeric;to_before numeric;to_after numeric;movement uuid;begin
 if actor is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=actor and role in ('admin','dispatcher')) then raise exception 'Warehouse planner access required' using errcode='42501';end if;
 if p_operation is null or p_operation not in ('receive','issue','transfer') or p_quantity is null or not(p_quantity>0 and p_quantity<=1000000000) or p_quantity<>trunc(p_quantity,3) or p_nonce is null or p_note is null or length(btrim(p_note)) not between 6 and 500 then raise exception 'Valid operation, quantity, reason and request identity are required' using errcode='22023';end if;
 if (p_operation='transfer' and (p_to_location_id is null or p_to_location_id=p_location_id)) or (p_operation<>'transfer' and p_to_location_id is not null) then raise exception 'Choose a different destination for transfers only' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text||':'||p_item_id::text,4827));
 select * into prior from public.at_inventory_movements where organization_id=p_organization_id and client_nonce=p_nonce;
 if found then
  if prior.actor_user_id<>actor or prior.item_id<>p_item_id or prior.location_id<>p_location_id or prior.operation<>p_operation or prior.quantity<>p_quantity or prior.note<>btrim(p_note) or prior.to_location_id is distinct from p_to_location_id then raise exception 'Request identity was already used for a different movement' using errcode='22023';end if;
  return jsonb_build_object('id',prior.id,'quantity',prior.after_quantity,'destination_quantity',prior.to_after_quantity,'replayed',true);
 end if;
 if not exists(select 1 from public.at_inventory_items where id=p_item_id and organization_id=p_organization_id) or not exists(select 1 from public.at_warehouse_locations where id=p_location_id and organization_id=p_organization_id) or (p_operation='transfer' and not exists(select 1 from public.at_warehouse_locations where id=p_to_location_id and organization_id=p_organization_id)) then raise exception 'Item and locations must belong to your organization' using errcode='42501';end if;
 insert into public.at_inventory_balances(organization_id,item_id,location_id) values(p_organization_id,p_item_id,p_location_id) on conflict do nothing;
 select quantity into before_qty from public.at_inventory_balances where organization_id=p_organization_id and item_id=p_item_id and location_id=p_location_id for update;
 after_qty:=case when p_operation='receive' then before_qty+p_quantity else before_qty-p_quantity end;
 if after_qty<0 or after_qty>1000000000 then raise exception 'Movement exceeds available stock or storage limit' using errcode='23514';end if;
 if p_operation='transfer' then
  insert into public.at_inventory_balances(organization_id,item_id,location_id) values(p_organization_id,p_item_id,p_to_location_id) on conflict do nothing;
  select quantity into to_before from public.at_inventory_balances where organization_id=p_organization_id and item_id=p_item_id and location_id=p_to_location_id for update;
  to_after:=to_before+p_quantity;
  if to_after>1000000000 then raise exception 'Destination storage limit exceeded' using errcode='23514';end if;
  update public.at_inventory_balances set quantity=to_after,updated_at=clock_timestamp() where organization_id=p_organization_id and item_id=p_item_id and location_id=p_to_location_id;
 end if;
 update public.at_inventory_balances set quantity=after_qty,updated_at=clock_timestamp() where organization_id=p_organization_id and item_id=p_item_id and location_id=p_location_id;
 insert into public.at_inventory_movements(organization_id,item_id,location_id,to_location_id,operation,quantity,before_quantity,after_quantity,to_before_quantity,to_after_quantity,note,actor_user_id,client_nonce)
 values(p_organization_id,p_item_id,p_location_id,p_to_location_id,p_operation,p_quantity,before_qty,after_qty,to_before,to_after,btrim(p_note),actor,p_nonce) returning id into movement;
 return jsonb_build_object('id',movement,'quantity',after_qty,'destination_quantity',to_after,'replayed',false);
end $$;
revoke all on function at_private.create_inventory_item(uuid,text,text,text,numeric),at_private.create_warehouse_location(uuid,text,text),at_private.record_inventory_movement(uuid,uuid,uuid,text,numeric,text,uuid,uuid) from public,anon,authenticated;
grant execute on function at_private.create_inventory_item(uuid,text,text,text,numeric),at_private.create_warehouse_location(uuid,text,text),at_private.record_inventory_movement(uuid,uuid,uuid,text,numeric,text,uuid,uuid) to authenticated;
create function public.at_create_inventory_item(p_organization_id uuid,p_sku text,p_name text,p_unit text,p_reorder_point numeric) returns uuid language sql security invoker set search_path='' as $$select at_private.create_inventory_item(p_organization_id,p_sku,p_name,p_unit,p_reorder_point)$$;
create function public.at_create_warehouse_location(p_organization_id uuid,p_code text,p_name text) returns uuid language sql security invoker set search_path='' as $$select at_private.create_warehouse_location(p_organization_id,p_code,p_name)$$;
create function public.at_record_inventory_movement(p_organization_id uuid,p_item_id uuid,p_location_id uuid,p_operation text,p_quantity numeric,p_note text,p_nonce uuid,p_to_location_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select at_private.record_inventory_movement(p_organization_id,p_item_id,p_location_id,p_operation,p_quantity,p_note,p_nonce,p_to_location_id)$$;
revoke all on function public.at_create_inventory_item(uuid,text,text,text,numeric),public.at_create_warehouse_location(uuid,text,text),public.at_record_inventory_movement(uuid,uuid,uuid,text,numeric,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.at_create_inventory_item(uuid,text,text,text,numeric),public.at_create_warehouse_location(uuid,text,text),public.at_record_inventory_movement(uuid,uuid,uuid,text,numeric,text,uuid,uuid) to authenticated;
