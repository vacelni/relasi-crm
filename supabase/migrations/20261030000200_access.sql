-- Relasi access control.
--
-- Roles per organization:
--   owner  everything, including roles and billing; exactly one per organization
--   admin  manages members, invitations, pipeline stages, and every record
--   sales  reads everything in the organization, edits the records they own
--
-- Every grant is explicit and column-level, so org_id (the tenant key) can
-- never be changed by an UPDATE. Policies only match callers with a
-- membership, because the helpers return NULL/false otherwise.

-- New tables and functions get no client privileges unless a migration grants
-- them (fail closed). Supabase's defaults would otherwise let any signed-in
-- user execute every new function.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke all on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies can read memberships without
-- re-entering the memberships policy (no recursion). They live in the private
-- schema, which the Data API does not expose.
-- ---------------------------------------------------------------------------
create function private.member_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.memberships m
  where m.org_id = p_org and m.user_id = (select auth.uid())
$$;

create function private.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  )
$$;

create function private.is_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.member_role(p_org) in ('owner', 'admin'), false)
$$;

-- Plan limits (README "Plans"). A lapsed Pro subscription falls back to Free.
create function private.plan_limits(p_org uuid, out seats integer, out ai_per_day integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when o.plan = 'pro' and coalesce(o.plan_expires_at > now(), true) then 25 else 3 end,
    case
      when o.is_demo then 60
      when o.plan = 'pro' and coalesce(o.plan_expires_at > now(), true) then 500
      else 30
    end
  from public.organizations o
  where o.id = p_org
$$;

revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.member_role(uuid), private.is_member(uuid), private.is_admin(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, then the minimum per table.
-- ---------------------------------------------------------------------------
revoke all on table
  public.organizations, public.profiles, public.memberships, public.invitations,
  public.companies, public.contacts, public.pipeline_stages, public.deals, public.activities,
  public.audit_log, public.ai_usage, public.billing_orders
from public, anon, authenticated;

grant select on table public.organizations to authenticated;
grant update (name) on table public.organizations to authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

grant select on table public.memberships to authenticated;

grant select, delete on table public.invitations to authenticated;
grant insert (org_id, email, role) on table public.invitations to authenticated;

grant select, delete on table public.companies to authenticated;
grant insert (org_id, name, domain, industry) on table public.companies to authenticated;
grant update (name, domain, industry) on table public.companies to authenticated;

grant select, delete on table public.contacts to authenticated;
grant insert (org_id, company_id, full_name, email, phone, title, status, source, notes, owner_id)
  on table public.contacts to authenticated;
-- AI columns are written only through save_contact_ai().
grant update (company_id, full_name, email, phone, title, status, source, notes, owner_id)
  on table public.contacts to authenticated;

grant select, delete on table public.pipeline_stages to authenticated;
grant insert (org_id, name, position, probability, kind) on table public.pipeline_stages to authenticated;
grant update (name, position, probability, kind) on table public.pipeline_stages to authenticated;

grant select, delete on table public.deals to authenticated;
grant insert (org_id, title, value, stage_id, contact_id, company_id, owner_id, position, expected_close)
  on table public.deals to authenticated;
grant update (title, value, stage_id, contact_id, company_id, owner_id, position, expected_close)
  on table public.deals to authenticated;

grant select, delete on table public.activities to authenticated;
grant insert (org_id, kind, subject, body, contact_id, deal_id, due_at, completed_at, owner_id)
  on table public.activities to authenticated;
grant update (kind, subject, body, due_at, completed_at, owner_id) on table public.activities to authenticated;

grant select on table public.audit_log to authenticated;
grant select on table public.ai_usage to authenticated;
grant select on table public.billing_orders to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.audit_log enable row level security;
alter table public.ai_usage enable row level security;
alter table public.billing_orders enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using ((select private.is_member(id)));
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.is_admin(id))) with check ((select private.is_admin(id)));

-- Yourself, and the people you share an organization with.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships theirs
      where theirs.user_id = profiles.id and (select private.is_member(theirs.org_id))
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Membership changes go through the RPCs below.
create policy memberships_select on public.memberships for select to authenticated
  using ((select private.is_member(org_id)));

create policy invitations_select on public.invitations for select to authenticated
  using ((select private.is_admin(org_id)));
create policy invitations_insert on public.invitations for insert to authenticated
  with check ((select private.is_admin(org_id)));
create policy invitations_delete on public.invitations for delete to authenticated
  using ((select private.is_admin(org_id)));

-- Companies are shared: any member maintains them, admins delete.
create policy companies_select on public.companies for select to authenticated
  using ((select private.is_member(org_id)));
create policy companies_insert on public.companies for insert to authenticated
  with check ((select private.is_member(org_id)));
create policy companies_update on public.companies for update to authenticated
  using ((select private.is_member(org_id))) with check ((select private.is_member(org_id)));
create policy companies_delete on public.companies for delete to authenticated
  using ((select private.is_admin(org_id)));

-- Contacts and deals: sales edit their own; admins edit and delete any.
create policy contacts_select on public.contacts for select to authenticated
  using ((select private.is_member(org_id)));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (
    (select private.is_member(org_id))
    and (owner_id = (select auth.uid()) or (select private.is_admin(org_id)))
  );
create policy contacts_update on public.contacts for update to authenticated
  using ((select private.is_admin(org_id)) or (owner_id = (select auth.uid()) and (select private.is_member(org_id))))
  with check ((select private.is_admin(org_id)) or (owner_id = (select auth.uid()) and (select private.is_member(org_id))));
create policy contacts_delete on public.contacts for delete to authenticated
  using ((select private.is_admin(org_id)));

create policy deals_select on public.deals for select to authenticated
  using ((select private.is_member(org_id)));
create policy deals_insert on public.deals for insert to authenticated
  with check (
    (select private.is_member(org_id))
    and (owner_id = (select auth.uid()) or (select private.is_admin(org_id)))
  );
create policy deals_update on public.deals for update to authenticated
  using ((select private.is_admin(org_id)) or (owner_id = (select auth.uid()) and (select private.is_member(org_id))))
  with check ((select private.is_admin(org_id)) or (owner_id = (select auth.uid()) and (select private.is_member(org_id))));
create policy deals_delete on public.deals for delete to authenticated
  using ((select private.is_admin(org_id)));

create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using ((select private.is_member(org_id)));
create policy pipeline_stages_insert on public.pipeline_stages for insert to authenticated
  with check ((select private.is_admin(org_id)));
create policy pipeline_stages_update on public.pipeline_stages for update to authenticated
  using ((select private.is_admin(org_id))) with check ((select private.is_admin(org_id)));
create policy pipeline_stages_delete on public.pipeline_stages for delete to authenticated
  using ((select private.is_admin(org_id)));

-- Activities: anyone logs; the author (or an admin) edits and deletes.
create policy activities_select on public.activities for select to authenticated
  using ((select private.is_member(org_id)));
create policy activities_insert on public.activities for insert to authenticated
  with check (
    (select private.is_member(org_id))
    and (owner_id = (select auth.uid()) or (select private.is_admin(org_id)))
  );
create policy activities_update on public.activities for update to authenticated
  using ((select private.is_admin(org_id)) or (owner_id = (select auth.uid()) and (select private.is_member(org_id))))
  with check ((select private.is_admin(org_id)) or (owner_id = (select auth.uid()) and (select private.is_member(org_id))));
create policy activities_delete on public.activities for delete to authenticated
  using ((select private.is_admin(org_id)) or (owner_id = (select auth.uid()) and (select private.is_member(org_id))));

create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.is_admin(org_id)));
create policy ai_usage_select on public.ai_usage for select to authenticated
  using ((select private.is_member(org_id)));
create policy billing_orders_select on public.billing_orders for select to authenticated
  using ((select private.member_role(org_id)) = 'owner');

-- ---------------------------------------------------------------------------
-- Seat limit and demo guards
-- ---------------------------------------------------------------------------
create function private.check_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used integer;
begin
  -- Non-admins are rejected by the insert policy; do not tell them anything first.
  if not private.is_admin(new.org_id) then
    return new;
  end if;

  if (select o.is_demo from public.organizations o where o.id = new.org_id) then
    raise exception 'invitations are disabled in the demo workspace' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.memberships m join public.profiles p on p.id = m.user_id
             where m.org_id = new.org_id and p.email = new.email) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  select
    (select count(*) from public.memberships m where m.org_id = new.org_id)
    + (select count(*) from public.invitations i
       where i.org_id = new.org_id and i.accepted_at is null and i.expires_at > now())
  into v_used;

  if v_used >= (select l.seats from private.plan_limits(new.org_id) l) then
    raise exception 'seat limit reached for this plan' using errcode = 'P0001', hint = 'upgrade';
  end if;
  return new;
end;
$$;

create trigger invitations_check before insert on public.invitations
  for each row execute function private.check_invitation();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates an organization with the caller as owner and a default pipeline.
create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships m where m.user_id = v_uid and m.role = 'owner') >= 3 then
    raise exception 'you can own at most 3 organizations' using errcode = 'P0001';
  end if;

  insert into public.organizations (name) values (btrim(p_name)) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into public.pipeline_stages (org_id, name, position, probability, kind) values
    (v_org, 'Lead', 0, 10, 'open'),
    (v_org, 'Qualified', 1, 25, 'open'),
    (v_org, 'Proposal', 2, 50, 'open'),
    (v_org, 'Negotiation', 3, 75, 'open'),
    (v_org, 'Won', 4, 100, 'won'),
    (v_org, 'Lost', 5, 0, 'lost');
  return v_org;
end;
$$;

-- Joins the organization an invitation is for. The invitation must be
-- addressed to the caller's email, unexpired, and unused.
create function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_email text := lower((select auth.jwt()) ->> 'email');
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations i where i.token = p_token for update;
  if not found or v_inv.accepted_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation is invalid or expired' using errcode = 'P0002';
  end if;
  if v_inv.email <> v_email then
    raise exception 'this invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, (select auth.uid()), v_inv.role)
  on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

-- Only the owner changes roles; ownership itself is not transferable here.
create function public.set_member_role(p_org uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.member_role(p_org) is distinct from 'owner' then
    raise exception 'only the owner can change roles' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'sales') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if (select o.is_demo from public.organizations o where o.id = p_org) then
    raise exception 'roles are fixed in the demo workspace' using errcode = 'P0001';
  end if;

  update public.memberships m set role = p_role
  where m.org_id = p_org and m.user_id = p_user and m.role <> 'owner';
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Owners remove anyone but themselves, admins remove sales, anyone but the
-- owner can leave. The leaver's records stay, with no owner.
create function public.remove_member(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me text := private.member_role(p_org);
  v_target text;
begin
  select m.role into v_target from public.memberships m where m.org_id = p_org and m.user_id = p_user;
  if v_me is null or v_target is null then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if (select o.is_demo from public.organizations o where o.id = p_org) then
    raise exception 'members are fixed in the demo workspace' using errcode = 'P0001';
  end if;
  if v_target = 'owner' then
    raise exception 'the owner cannot be removed' using errcode = '42501';
  end if;
  if not (
    p_user = (select auth.uid())
    or v_me = 'owner'
    or (v_me = 'admin' and v_target = 'sales')
  ) then
    raise exception 'not allowed to remove this member' using errcode = '42501';
  end if;

  delete from public.memberships m where m.org_id = p_org and m.user_id = p_user;
end;
$$;

-- Reserves one AI call for the organization, or raises when the daily plan
-- quota or the per-user burst limit (8 per minute) is used up. Returns the
-- usage row id (for record_ai_tokens) and the calls left today.
create function public.consume_ai_quota(p_org uuid, p_feature text, out usage_id bigint, out remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer;
  v_used integer;
begin
  if not private.is_member(p_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  -- Serialize per organization so two concurrent calls cannot both take the last slot.
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));

  if (select count(*) from public.ai_usage u
      where u.user_id = v_uid and u.created_at > now() - interval '1 minute') >= 8 then
    raise exception 'too many AI requests, try again in a minute' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  select l.ai_per_day into v_limit from private.plan_limits(p_org) l;
  select count(*) into v_used from public.ai_usage u
  where u.org_id = p_org and u.created_at > now() - interval '1 day';
  if v_used >= v_limit then
    raise exception 'daily AI quota reached for this plan' using errcode = 'P0001', hint = 'quota';
  end if;

  insert into public.ai_usage (org_id, user_id, feature) values (p_org, v_uid, p_feature)
  returning id into usage_id;
  remaining := v_limit - v_used - 1;
end;
$$;

create function public.record_ai_tokens(p_usage_id bigint, p_input integer, p_output integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage set input_tokens = greatest(p_input, 0), output_tokens = greatest(p_output, 0)
  where id = p_usage_id and user_id = (select auth.uid()) and input_tokens is null
$$;

-- Stores an AI lead score and/or summary on a contact. Any member may: the
-- values describe the contact, they do not change who owns it.
create function public.save_contact_ai(
  p_contact uuid,
  p_score smallint default null,
  p_reasons jsonb default null,
  p_summary text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contacts c set
    ai_score = coalesce(p_score, c.ai_score),
    ai_score_reasons = coalesce(p_reasons, c.ai_score_reasons),
    ai_summary = coalesce(left(p_summary, 2000), c.ai_summary),
    ai_updated_at = now()
  where c.id = p_contact and private.is_member(c.org_id);
  if not found then
    raise exception 'contact not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Dashboard numbers. SECURITY INVOKER: RLS limits it to the caller's rows.
create function public.org_metrics(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with closed as (
    select s.kind, d.value from public.deals d join public.pipeline_stages s on s.id = d.stage_id
    where d.org_id = p_org and s.kind <> 'open' and d.closed_at > now() - interval '90 days'
  )
  select jsonb_build_object(
    'win_rate',
      (select round(count(*) filter (where kind = 'won')::numeric / nullif(count(*), 0), 4) from closed),
    'won_value_90d', (select coalesce(sum(value) filter (where kind = 'won'), 0) from closed),
    'won_count_90d', (select count(*) filter (where kind = 'won') from closed),
    'lost_count_90d', (select count(*) filter (where kind = 'lost') from closed),
    'open_value',
      (select coalesce(sum(d.value), 0) from public.deals d join public.pipeline_stages s on s.id = d.stage_id
       where d.org_id = p_org and s.kind = 'open'),
    'weighted_value',
      (select coalesce(round(sum(d.value * s.probability / 100.0)), 0)
       from public.deals d join public.pipeline_stages s on s.id = d.stage_id
       where d.org_id = p_org and s.kind = 'open'),
    'contacts', (select count(*) from public.contacts c where c.org_id = p_org),
    'overdue_tasks',
      (select count(*) from public.activities a
       where a.org_id = p_org and a.completed_at is null and a.due_at < now()),
    'stages', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'kind', s.kind, 'probability', s.probability,
        'count', coalesce(t.n, 0), 'value', coalesce(t.v, 0)) order by s.position), '[]')
      from public.pipeline_stages s
      left join (select d.stage_id, count(*) n, sum(d.value) v from public.deals d
                 where d.org_id = p_org group by d.stage_id) t on t.stage_id = s.id
      where s.org_id = p_org
    )
  )
$$;

-- Bulk insert for CSV import and AI extraction: up to 1000 rows of
-- {full_name, email, phone, title, company, notes}. Companies are matched by name (case-insensitive) or created; rows
-- whose email already exists in the organization are skipped. SECURITY
-- INVOKER, so every insert is checked by the same policies as the UI.
create function public.import_contacts(p_org uuid, p_rows jsonb, p_source text default 'import')
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_company uuid;
  v_company_name text;
  v_email text;
  v_inserted integer := 0;
  v_skipped integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'expected an array of at most 1000 rows' using errcode = '22023';
  end if;
  if p_source not in ('import', 'ai_extract') then
    raise exception 'invalid source' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_email := nullif(lower(btrim(v_row ->> 'email')), '');
    if v_email is not null and exists (
      select 1 from public.contacts c where c.org_id = p_org and c.email = v_email
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_company := null;
    v_company_name := nullif(btrim(v_row ->> 'company'), '');
    if v_company_name is not null then
      select c.id into v_company from public.companies c
      where c.org_id = p_org and lower(c.name) = lower(v_company_name);
      if v_company is null then
        insert into public.companies (org_id, name) values (p_org, v_company_name) returning id into v_company;
      end if;
    end if;

    insert into public.contacts (org_id, company_id, full_name, email, phone, title, notes, source)
    values (
      p_org, v_company, btrim(v_row ->> 'full_name'), v_email,
      nullif(btrim(v_row ->> 'phone'), ''), nullif(btrim(v_row ->> 'title'), ''),
      nullif(btrim(v_row ->> 'notes'), ''), p_source
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

-- Billing. Prices are fixed here, never taken from the client.
create function public.create_billing_order(p_org uuid, p_months smallint)
returns public.billing_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.billing_orders;
begin
  if private.member_role(p_org) is distinct from 'owner' then
    raise exception 'only the owner can manage billing' using errcode = '42501';
  end if;
  if p_months not in (1, 12) then
    raise exception 'choose 1 or 12 months' using errcode = '22023';
  end if;

  insert into public.billing_orders (id, org_id, plan, months, amount, created_by)
  values (
    'relasi-' || replace(gen_random_uuid()::text, '-', ''),
    p_org, 'pro', p_months,
    -- Rp149.000 per month; the yearly plan is two months free.
    case p_months when 12 then 1490000 else 149000 end,
    (select auth.uid())
  )
  returning * into v_order;
  return v_order;
end;
$$;

-- Called by the payment webhook (service role) after the notification's
-- signature is verified. The paid amount must match the order. Idempotent: a
-- repeated notification for a paid order does nothing.
create function public.apply_billing_notification(p_order text, p_status text, p_amount bigint, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.billing_orders;
begin
  select * into v_order from public.billing_orders o where o.id = p_order for update;
  if not found then
    raise exception 'unknown order' using errcode = 'P0002';
  end if;
  if v_order.status = 'paid' then
    return;
  end if;
  if p_amount <> v_order.amount then
    raise exception 'amount does not match the order' using errcode = '22023';
  end if;

  if p_status = 'paid' then
    update public.billing_orders set status = 'paid', paid_at = now(), provider_payload = p_payload
    where id = p_order;
    update public.organizations o set
      plan = 'pro',
      plan_expires_at = greatest(coalesce(o.plan_expires_at, now()), now()) + make_interval(months => v_order.months)
    where o.id = v_order.org_id;
  elsif p_status in ('failed', 'expired') then
    update public.billing_orders set status = p_status, provider_payload = p_payload where id = p_order;
  end if;
end;
$$;

revoke all on function
  public.create_organization(text),
  public.accept_invitation(uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.consume_ai_quota(uuid, text),
  public.record_ai_tokens(bigint, integer, integer),
  public.save_contact_ai(uuid, smallint, jsonb, text),
  public.org_metrics(uuid),
  public.import_contacts(uuid, jsonb, text),
  public.create_billing_order(uuid, smallint),
  public.apply_billing_notification(text, text, bigint, jsonb)
from public, anon, authenticated;

grant execute on function
  public.create_organization(text),
  public.accept_invitation(uuid),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid),
  public.consume_ai_quota(uuid, text),
  public.record_ai_tokens(bigint, integer, integer),
  public.save_contact_ai(uuid, smallint, jsonb, text),
  public.org_metrics(uuid),
  public.import_contacts(uuid, jsonb, text),
  public.create_billing_order(uuid, smallint)
to authenticated;

grant execute on function public.apply_billing_notification(text, text, bigint, jsonb) to service_role;
