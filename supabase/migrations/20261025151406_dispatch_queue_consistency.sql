-- Direct offers and FIFO claims consume the same pending service request atomically.
create function at_private.consume_service_queue() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.service_id is not null and new.status='offered' and old.status='unassigned' then
    update public.at_dispatch_requests set status='assigned',assignment_id=new.id,handled_by=auth.uid(),handled_at=clock_timestamp()
    where organization_id=new.organization_id and driver_user_id=new.driver_user_id and status='queued';
  end if;
  return new;
end $$;
revoke all on function at_private.consume_service_queue() from public,anon,authenticated;
create trigger consume_service_queue after update on public.at_assignments for each row execute function at_private.consume_service_queue();

-- Preserve the legacy endpoint but apply the newly required location gate in staging.
create or replace function public.at_request_dispatch(p_organization_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.at_live_driver_locations where organization_id=p_organization_id and driver_user_id=auth.uid()
    and online and sharing and last_ping_at>clock_timestamp()-interval '60 seconds')
  then raise exception 'Go online with fresh location sharing before joining dispatch' using errcode='23514';end if;
  return at_private.request_dispatch(p_organization_id);
end $$;
