-- A dispatch-only tracking session is never silently exposed to customers.
alter table public.at_live_driver_locations add column customer_tracking_session_id uuid;
create function at_private.consent_customer_tracking(p_organization_id uuid,p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_session_id is null or not exists(select 1 from public.at_organization_members where organization_id=p_organization_id and user_id=auth.uid() and role='driver') then raise exception 'Driver session required' using errcode='42501';end if;
 update public.at_live_driver_locations set customer_tracking_session_id=p_session_id where organization_id=p_organization_id and driver_user_id=auth.uid() and sharing and tracking_session_id=p_session_id;
 if not found then raise exception 'Tracking session is no longer active' using errcode='42501';end if;
end $$;
revoke all on function at_private.consent_customer_tracking(uuid,uuid) from public,anon;grant execute on function at_private.consent_customer_tracking(uuid,uuid) to authenticated;
create function public.at_consent_customer_tracking(p_organization_id uuid,p_session_id uuid) returns void language sql security invoker set search_path='' as $$select at_private.consent_customer_tracking(p_organization_id,p_session_id)$$;
revoke all on function public.at_consent_customer_tracking(uuid,uuid) from public,anon;grant execute on function public.at_consent_customer_tracking(uuid,uuid) to authenticated;
create or replace function at_private.customer_shipment_status(p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.at_customer_requests;a public.at_assignments;gps jsonb;proof jsonb;events jsonb;
begin
 if not at_private.can_read_customer_request(p_request_id) then raise exception 'Shipment permission required' using errcode='42501';end if;
 select * into r from public.at_customer_requests where id=p_request_id;select * into a from public.at_assignments where id=r.assignment_id;
 -- Temporary per-shipment entitlement. No GPS after delivery/cancellation or on another load.
 if a.status='in_transit' then select jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'last_ping_at',l.last_ping_at,'online',true,'sharing',true) into gps from public.at_live_driver_locations l where l.organization_id=r.organization_id and l.driver_user_id=a.driver_user_id and l.online and l.sharing and l.customer_tracking_session_id=l.tracking_session_id and l.latitude is not null and l.longitude is not null and l.last_ping_at>now()-interval '60 seconds';end if;
 if a.status='delivered' then select jsonb_build_object('confirmed_at',p.confirmed_at,'evidence_path',p.evidence_path) into proof from public.at_delivery_proofs p where p.assignment_id=a.id;end if;
 select coalesce(jsonb_agg(x order by x.occurred_at),'[]'::jsonb) into events from(select action,next_status,occurred_at from public.at_assignment_events where assignment_id=a.id order by occurred_at desc limit 100)x;
 return jsonb_build_object('status',coalesce(a.status,r.status),'updated_at',coalesce(a.updated_at,r.updated_at),'gps',gps,'proof',proof,'events',events,'tracking_expires_at',case when gps is not null then (gps->>'last_ping_at')::timestamptz+interval '60 seconds' end);
end $$;
