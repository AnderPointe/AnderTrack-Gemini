-- Staging only: self-service accounts never join an existing organization.
create table public.at_platform_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(btrim(display_name)) between 2 and 120),
  account_kind text not null check(account_kind in ('individual','company')),
  company_name text check(company_name is null or length(btrim(company_name)) between 2 and 160),
  organization_id uuid unique references public.at_organizations(id),
  created_at timestamptz not null default now(),
  constraint platform_account_company_shape check (
    (account_kind='individual' and company_name is null and organization_id is null) or
    (account_kind='company' and company_name is not null and organization_id is not null)
  )
);
alter table public.at_platform_accounts enable row level security;
revoke all on public.at_platform_accounts from anon,authenticated;
grant select on public.at_platform_accounts to authenticated;
create policy platform_account_self_read on public.at_platform_accounts for select to authenticated using(user_id=(select auth.uid()));

create function at_private.complete_platform_signup(p_display_name text,p_account_kind text,p_company_name text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); account public.at_platform_accounts; company_id uuid;
begin
  if actor is null then raise exception 'Sign in before completing your account' using errcode='42501';end if;
  if not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then
    raise exception 'Confirm your email before completing account setup' using errcode='42501';end if;
  if p_display_name is null or length(btrim(p_display_name)) not between 2 and 120 or p_account_kind is null or p_account_kind not in ('individual','company') then
    raise exception 'Enter a valid name and account type' using errcode='22023';end if;
  if p_account_kind='company' and (p_company_name is null or length(btrim(p_company_name)) not between 2 and 160) then
    raise exception 'Enter a company name between 2 and 160 characters' using errcode='22023';end if;
  -- One immutable onboarding result per verified identity; retries cannot create more tenants.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
  select * into account from public.at_platform_accounts where user_id=actor;
  if found then return to_jsonb(account);end if;
  if p_account_kind='company' then
    insert into public.at_organizations(name) values(btrim(p_company_name)) returning id into company_id;
    insert into public.at_organization_members(organization_id,user_id,role) values(company_id,actor,'admin');
  end if;
  insert into public.at_platform_accounts(user_id,display_name,account_kind,company_name,organization_id)
  values(actor,btrim(p_display_name),p_account_kind,case when p_account_kind='company' then btrim(p_company_name) end,company_id) returning * into account;
  return to_jsonb(account);
end $$;
revoke all on function at_private.complete_platform_signup(text,text,text) from public,anon,authenticated;
grant execute on function at_private.complete_platform_signup(text,text,text) to authenticated;
create function public.at_complete_platform_signup(p_display_name text,p_account_kind text,p_company_name text default null)
returns jsonb language sql security invoker set search_path='' as $$select at_private.complete_platform_signup(p_display_name,p_account_kind,p_company_name)$$;
revoke all on function public.at_complete_platform_signup(text,text,text) from public,anon;
grant execute on function public.at_complete_platform_signup(text,text,text) to authenticated;
