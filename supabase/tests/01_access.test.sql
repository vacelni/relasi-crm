-- Tenant isolation, role permissions, and the RPC guards (migration *_access.sql).
-- Fixtures: organization A (owner, admin, sales) and organization B (owner),
-- plus a signed-in user with no membership. Everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;

select plan(46);

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.act_as(p_user uuid, p_email text default null)
returns void
language sql
as $$
  select set_config('role', 'authenticated', true);
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'email', p_email)::text,
    true
  );
$$;
grant execute on function tests.act_as(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('a0000000-0000-4000-8000-000000000001', 'a.owner@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000002', 'a.admin@test.local', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000003', 'a.sales@test.local', 'authenticated', 'authenticated'),
  ('b0000000-0000-4000-8000-000000000001', 'b.owner@test.local', 'authenticated', 'authenticated'),
  ('c0000000-0000-4000-8000-000000000001', 'nobody@test.local', 'authenticated', 'authenticated');

insert into public.organizations (id, name) values
  ('aa000000-0000-4000-8000-000000000001', 'Org A'),
  ('bb000000-0000-4000-8000-000000000001', 'Org B');

insert into public.memberships (org_id, user_id, role) values
  ('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'admin'),
  ('bb000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'owner');

insert into public.pipeline_stages (id, org_id, name, position, probability, kind) values
  ('aa500000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'Lead', 0, 10, 'open'),
  ('aa500000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-000000000001', 'Won', 1, 100, 'won');

insert into public.companies (id, org_id, name) values
  ('aac00000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'A Corp'),
  ('bbc00000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', 'B Corp');

insert into public.contacts (id, org_id, full_name, owner_id) values
  ('aa100000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000001', 'Admin''s contact',
    'a0000000-0000-4000-8000-000000000002'),
  ('bb100000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', 'B''s contact',
    'b0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every public table has RLS enabled'
);

-- ---------------------------------------------------------------------------
-- Anonymous callers
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok('select * from public.contacts', '42501', null, 'anon cannot read contacts');
select throws_ok('select * from public.organizations', '42501', null, 'anon cannot read organizations');
select throws_ok($$select public.create_organization('x')$$, '42501', null, 'anon cannot create organizations');
reset role;

-- ---------------------------------------------------------------------------
-- Invitations and joining (A has 2 of 3 free seats in use)
-- ---------------------------------------------------------------------------
select tests.act_as('a0000000-0000-4000-8000-000000000002');
select lives_ok(
  $$insert into public.invitations (org_id, email, role)
    values ('aa000000-0000-4000-8000-000000000001', 'a.sales@test.local', 'sales')$$,
  'an admin can invite'
);
select throws_ok(
  $$insert into public.invitations (org_id, email, role)
    values ('aa000000-0000-4000-8000-000000000001', 'extra@test.local', 'sales')$$,
  'P0001', 'seat limit reached for this plan',
  'the free plan stops at 3 seats, counting open invitations'
);
reset role;

-- The invitee cannot read invitations, so keep the token aside (as postgres).
create table tests.invite as select token from public.invitations where email = 'a.sales@test.local';
grant select on tests.invite to authenticated;

select tests.act_as('c0000000-0000-4000-8000-000000000001', 'nobody@test.local');
select throws_ok(
  format('select public.accept_invitation(%L)',
    (select token from tests.invite)),
  '42501', 'this invitation was sent to a different email address',
  'an invitation cannot be accepted by someone else'
);
reset role;

select tests.act_as('a0000000-0000-4000-8000-000000000003', 'a.sales@test.local');
select is(
  public.accept_invitation((select token from tests.invite)),
  'aa000000-0000-4000-8000-000000000001'::uuid,
  'the invited user joins with the invitation token'
);
select is(
  (select role from public.memberships where user_id = 'a0000000-0000-4000-8000-000000000003'),
  'sales',
  'with the invited role'
);
select throws_ok(
  format('select public.accept_invitation(%L)',
    (select token from tests.invite)),
  'P0002', null,
  'an invitation works once'
);
select throws_ok(
  $$insert into public.invitations (org_id, email, role)
    values ('aa000000-0000-4000-8000-000000000001', 'x@test.local', 'sales')$$,
  '42501', null,
  'sales cannot invite'
);
reset role;

-- ---------------------------------------------------------------------------
-- Tenant isolation
-- ---------------------------------------------------------------------------
select tests.act_as('b0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.contacts), 1, 'B sees only its own contacts');
select is((select count(*)::int from public.organizations), 1, 'B sees only its own organization');
select is(
  (select count(*)::int from public.profiles where email like 'a.%'), 0,
  'B cannot see the people of A'
);
select throws_ok(
  $$insert into public.contacts (org_id, full_name) values ('aa000000-0000-4000-8000-000000000001', 'Planted')$$,
  '42501', null,
  'B cannot insert into A'
);
select is_empty(
  $$update public.contacts set full_name = 'Hijacked' where org_id = 'aa000000-0000-4000-8000-000000000001' returning id$$,
  'B cannot update A''s contacts'
);
select throws_ok(
  $$select public.consume_ai_quota('aa000000-0000-4000-8000-000000000001', 'summary')$$,
  '42501', null,
  'B cannot spend A''s AI quota'
);
select throws_ok(
  $$select public.save_contact_ai('aa100000-0000-4000-8000-000000000001', 1::smallint)$$,
  'P0002', null,
  'B cannot write AI results onto A''s contacts'
);
select is(
  (public.org_metrics('aa000000-0000-4000-8000-000000000001') ->> 'contacts')::int, 0,
  'org_metrics reveals nothing about another organization'
);
reset role;

select tests.act_as('c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.contacts), 0, 'a user without a membership sees no contacts');
reset role;

-- ---------------------------------------------------------------------------
-- Sales permissions inside A
-- ---------------------------------------------------------------------------
select tests.act_as('a0000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.contacts), 1, 'sales reads every contact of the organization');
select lives_ok(
  $$insert into public.contacts (org_id, full_name)
    values ('aa000000-0000-4000-8000-000000000001', 'Sales lead')$$,
  'sales creates contacts (owned by themselves by default)'
);
select throws_ok(
  $$insert into public.contacts (org_id, full_name, owner_id)
    values ('aa000000-0000-4000-8000-000000000001', 'Gift', 'a0000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'sales cannot create records owned by someone else'
);
select is_empty(
  $$update public.contacts set full_name = 'Changed' where id = 'aa100000-0000-4000-8000-000000000001' returning id$$,
  'sales cannot edit a contact owned by someone else'
);
select isnt_empty(
  $$update public.contacts set notes = 'Called' where full_name = 'Sales lead' returning id$$,
  'sales edits their own contact'
);
select is_empty(
  $$delete from public.contacts where full_name = 'Sales lead' returning id$$,
  'sales cannot delete contacts'
);
select throws_ok(
  $$update public.contacts set org_id = 'bb000000-0000-4000-8000-000000000001'
    where full_name = 'Sales lead'$$,
  '42501', null,
  'org_id is not updatable'
);
select throws_ok(
  $$update public.contacts set ai_score = 99 where full_name = 'Sales lead'$$,
  '42501', null,
  'AI columns are only written through save_contact_ai'
);
select lives_ok(
  $$select public.save_contact_ai('aa100000-0000-4000-8000-000000000001', 80::smallint, '{"reasons": ["Budget approved"]}'::jsonb)$$,
  'any member stores an AI score on an organization contact'
);
select throws_ok(
  $$insert into public.pipeline_stages (org_id, name, position) values ('aa000000-0000-4000-8000-000000000001', 'X', 9)$$,
  '42501', null,
  'sales cannot change the pipeline'
);
select is((select count(*)::int from public.audit_log), 0, 'sales cannot read the audit log');
select throws_ok(
  $$select public.remove_member('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')$$,
  '42501', null,
  'sales cannot remove an admin'
);
select throws_ok(
  $$select public.create_billing_order('aa000000-0000-4000-8000-000000000001', 1::smallint)$$,
  '42501', null,
  'sales cannot start a payment'
);
select throws_ok(
  $$select public.apply_billing_notification('relasi-00000000', 'paid', 1, '{}')$$,
  '42501', null,
  'clients cannot mark orders paid'
);
select throws_ok($$select public.reset_demo()$$, '42501', null, 'clients cannot reset the demo');
reset role;

-- ---------------------------------------------------------------------------
-- Integrity across tenants
-- ---------------------------------------------------------------------------
select tests.act_as('a0000000-0000-4000-8000-000000000002');
select throws_ok(
  $$insert into public.contacts (org_id, full_name, company_id)
    values ('aa000000-0000-4000-8000-000000000001', 'Mixed', 'bbc00000-0000-4000-8000-000000000001')$$,
  '23503', null,
  'a contact cannot point at another organization''s company'
);
select throws_ok(
  $$update public.contacts set owner_id = 'b0000000-0000-4000-8000-000000000001'
    where id = 'aa100000-0000-4000-8000-000000000001'$$,
  '23514', null,
  'a record cannot be assigned to a non-member'
);

-- ---------------------------------------------------------------------------
-- Admin and owner
-- ---------------------------------------------------------------------------
select ok((select count(*) from public.audit_log) > 0, 'admins read the audit log');
select throws_ok(
  $$select public.set_member_role('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'admin')$$,
  '42501', null,
  'only the owner changes roles'
);
reset role;

select tests.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok(
  $$select public.set_member_role('aa000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'admin')$$,
  'the owner promotes a member'
);
select is(
  (public.create_billing_order('aa000000-0000-4000-8000-000000000001', 12::smallint)).amount,
  1490000::bigint,
  'the price comes from the database, not the client'
);
select results_eq(
  $$select remaining from public.consume_ai_quota('aa000000-0000-4000-8000-000000000001', 'summary')$$,
  $$values (29)$$,
  'a free organization has 30 AI calls a day'
);

insert into public.deals (org_id, title, stage_id)
values ('aa000000-0000-4000-8000-000000000001', 'Test deal',
  'aa500000-0000-4000-8000-000000000001');
update public.deals set stage_id = 'aa500000-0000-4000-8000-000000000002'
where title = 'Test deal';
select isnt(
  (select closed_at from public.deals where title = 'Test deal'), null,
  'moving a deal to a won stage closes it'
);
update public.deals set stage_id = 'aa500000-0000-4000-8000-000000000001'
where title = 'Test deal';
select is(
  (select closed_at from public.deals where title = 'Test deal'), null,
  'moving it back reopens it'
);
reset role;

-- ---------------------------------------------------------------------------
-- Demo workspace (seeded by reset_demo)
-- ---------------------------------------------------------------------------
select tests.act_as('de000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$insert into public.invitations (org_id, email, role)
    values ('de000000-0000-4000-8000-000000000001', 'someone@test.local', 'sales')$$,
  'P0001', 'invitations are disabled in the demo workspace',
  'the demo cannot invite real people'
);
select throws_ok(
  $$select public.remove_member('de000000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-0000000000a2')$$,
  'P0001', null,
  'demo members are fixed'
);
reset role;

select * from finish();
rollback;
