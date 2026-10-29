-- Relasi schema: organizations (tenants), their members, and the CRM records
-- every member works on. Access control lives in the next migration.
--
-- Tenant integrity: every child table carries org_id, and every reference to
-- another tenant-owned row is a composite foreign key (id, org_id), so a row
-- can never point at a record in a different organization, whatever the
-- policies say.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tenants and people
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_expires_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'sales')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);
-- Exactly one owner per organization.
create unique index memberships_one_owner_idx on public.memberships (org_id) where role = 'owner';

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null check (role in ('admin', 'sales')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);
create unique index invitations_open_email_idx on public.invitations (org_id, email) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- CRM records
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  domain text check (char_length(domain) <= 120),
  industry text check (char_length(industry) <= 80),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create unique index companies_org_name_idx on public.companies (org_id, lower(name));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone ~ '^\+?[0-9 ()-]{6,20}$'),
  title text check (char_length(title) <= 120),
  status text not null default 'lead' check (status in ('lead', 'qualified', 'customer', 'churned')),
  source text not null default 'manual'
    check (source in ('manual', 'import', 'ai_extract', 'referral', 'website', 'whatsapp', 'other')),
  notes text check (char_length(notes) <= 4000),
  owner_id uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Written by the AI features (lib/ai). ai_score_reasons holds the score's explanation:
  -- {reasons: string[], next_step, temperature, source}.
  ai_score smallint check (ai_score between 0 and 100),
  ai_score_reasons jsonb check (ai_score_reasons is null or jsonb_typeof(ai_score_reasons) = 'object'),
  ai_summary text check (char_length(ai_summary) <= 2000),
  ai_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (company_id, org_id) references public.companies (id, org_id) on delete set null (company_id)
);
create index contacts_org_id_idx on public.contacts (org_id, created_at desc);
create index contacts_company_id_idx on public.contacts (company_id);
create unique index contacts_org_email_idx on public.contacts (org_id, email) where email is not null;

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  position smallint not null check (position >= 0),
  probability smallint not null default 0 check (probability between 0 and 100),
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  unique (id, org_id)
);
create index pipeline_stages_org_idx on public.pipeline_stages (org_id, position);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  -- Whole rupiah; IDR has no minor unit in practice.
  value bigint not null default 0 check (value between 0 and 1000000000000),
  stage_id uuid not null,
  contact_id uuid,
  company_id uuid,
  owner_id uuid references public.profiles (id) on delete set null default auth.uid(),
  -- Order within a Kanban column. Fractional so a move rewrites one row.
  position double precision not null default 0,
  expected_close date,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (stage_id, org_id) references public.pipeline_stages (id, org_id),
  foreign key (contact_id, org_id) references public.contacts (id, org_id) on delete set null (contact_id),
  foreign key (company_id, org_id) references public.companies (id, org_id) on delete set null (company_id)
);
create index deals_org_stage_idx on public.deals (org_id, stage_id, position);
create index deals_contact_id_idx on public.deals (contact_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('note', 'call', 'meeting', 'email', 'whatsapp', 'task')),
  subject text not null check (char_length(btrim(subject)) between 1 and 200),
  body text check (char_length(body) <= 4000),
  contact_id uuid,
  deal_id uuid,
  -- Set for tasks and follow-ups: the reminder date.
  due_at timestamptz,
  completed_at timestamptz,
  owner_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (contact_id, org_id) references public.contacts (id, org_id) on delete cascade,
  foreign key (deal_id, org_id) references public.deals (id, org_id) on delete cascade
);
create index activities_contact_idx on public.activities (contact_id, created_at desc);
create index activities_deal_idx on public.activities (deal_id, created_at desc);
create index activities_due_idx on public.activities (org_id, due_at) where completed_at is null and due_at is not null;

-- ---------------------------------------------------------------------------
-- Bookkeeping: audit trail, AI usage (rate limits), billing orders
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,
  entity_id uuid,
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (org_id, created_at desc);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  feature text not null check (feature in ('summary', 'lead_score', 'follow_up', 'extract')),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index ai_usage_org_idx on public.ai_usage (org_id, created_at desc);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

create table public.billing_orders (
  -- Midtrans order_id; also what the payment notification refers to.
  id text primary key check (id ~ '^relasi-[a-z0-9-]{8,64}$'),
  org_id uuid not null references public.organizations (id) on delete cascade,
  plan text not null check (plan in ('pro')),
  months smallint not null check (months between 1 and 12),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  provider_payload jsonb
);
create index billing_orders_org_idx on public.billing_orders (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row maintenance triggers
-- ---------------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger companies_touch before update on public.companies
  for each row execute function private.touch_updated_at();
create trigger contacts_touch before update on public.contacts
  for each row execute function private.touch_updated_at();
create trigger deals_touch before update on public.deals
  for each row execute function private.touch_updated_at();

-- A deal is closed while it sits in a won or lost stage; moving it back to an
-- open stage reopens it.
create function private.deal_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
begin
  select s.kind into v_kind from public.pipeline_stages s where s.id = new.stage_id;
  if v_kind = 'open' then
    new.closed_at := null;
  elsif tg_op = 'INSERT' or old.stage_id is distinct from new.stage_id or new.closed_at is null then
    new.closed_at := coalesce(new.closed_at, now());
  end if;
  return new;
end;
$$;

create trigger deals_closed_at before insert or update of stage_id on public.deals
  for each row execute function private.deal_closed_at();

-- Every new auth user gets a profile; the app shows names and emails from it.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 80), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Record owners must belong to the record's organization.
create function private.check_owner_is_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A caller outside the organization is rejected by the insert/update policy;
  -- do not reveal who its members are first.
  if (select auth.uid()) is not null and not exists (
    select 1 from public.memberships m where m.org_id = new.org_id and m.user_id = (select auth.uid())
  ) then
    return new;
  end if;

  if new.owner_id is not null and not exists (
    select 1 from public.memberships m where m.org_id = new.org_id and m.user_id = new.owner_id
  ) then
    raise exception 'owner must be a member of the organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger contacts_owner_member before insert or update of owner_id, org_id on public.contacts
  for each row execute function private.check_owner_is_member();
create trigger deals_owner_member before insert or update of owner_id, org_id on public.deals
  for each row execute function private.check_owner_is_member();
create trigger activities_owner_member before insert or update of owner_id, org_id on public.activities
  for each row execute function private.check_owner_is_member();

-- ---------------------------------------------------------------------------
-- Audit trail: one row per change to the records an admin wants to trace.
-- Updates store only the columns that changed (new values).
-- ---------------------------------------------------------------------------
create function private.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
begin
  -- Deleting an organization cascades to its rows; there is nothing left to audit.
  if not exists (select 1 from public.organizations o where o.id = (v_row ->> 'org_id')::uuid) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- AI fields are rewritten on every scoring/summary run; the AI usage table tracks those.
    select coalesce(jsonb_object_agg(n.key, n.value), '{}') into v_changes
    from jsonb_each(v_new) n
    where n.key not in ('updated_at', 'position')
      and n.key not like 'ai\_%'
      and n.value is distinct from v_old -> n.key;
    -- Reordering inside a column, or a touch with nothing changed, is noise.
    if v_changes = '{}' then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - 'org_id';
  else
    v_changes := v_old - 'org_id';
  end if;

  insert into public.audit_log (org_id, actor_id, action, entity, entity_id, changes)
  values (
    (v_row ->> 'org_id')::uuid,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce((v_row ->> 'id')::uuid, (v_row ->> 'user_id')::uuid),
    v_changes
  );
  return null;
end;
$$;

create trigger companies_audit after insert or update or delete on public.companies
  for each row execute function private.audit();
create trigger contacts_audit after insert or update or delete on public.contacts
  for each row execute function private.audit();
create trigger deals_audit after insert or update or delete on public.deals
  for each row execute function private.audit();
create trigger pipeline_stages_audit after insert or update or delete on public.pipeline_stages
  for each row execute function private.audit();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function private.audit();
create trigger invitations_audit after insert or delete on public.invitations
  for each row execute function private.audit();
