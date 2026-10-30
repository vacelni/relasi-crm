-- The public demo workspace. reset_demo() (re)creates two demo accounts and
-- one organization full of sample data; the seed calls it locally, and the
-- hosted demo runs it hourly (supabase/demo/schedule.sql) so visitors always
-- start from the same state. AI usage rows are kept on purpose: a reset must
-- not refill the daily AI quota.
--
-- Every name, email (example.com), and phone number below is made up.

create function public.reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org constant uuid := 'de000000-0000-4000-8000-000000000001';
  v_owner constant uuid := 'de000000-0000-4000-8000-0000000000a1';
  v_sales constant uuid := 'de000000-0000-4000-8000-0000000000a2';
  v_password constant text := 'relasi-demo';
  s_lead uuid; s_qual uuid; s_prop uuid; s_nego uuid; s_won uuid; s_lost uuid;
  c record;
begin
  -- Accounts: create once, then restore name and password on every reset.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
    extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
    '', '', '', ''
  from (values
    (v_owner, 'owner@demo.relasi.test', 'Rina Wijaya'),
    (v_sales, 'sales@demo.relasi.test', 'Budi Santoso')
  ) as u (id, email, full_name)
  where not exists (select 1 from auth.users x where x.id = u.id);

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  from auth.users u
  where u.id in (v_owner, v_sales)
    and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

  update auth.users set
    encrypted_password = extensions.crypt(v_password, extensions.gen_salt('bf')),
    email = case id when v_owner then 'owner@demo.relasi.test' else 'sales@demo.relasi.test' end,
    banned_until = null
  where id in (v_owner, v_sales);
  update public.profiles set
    full_name = case id when v_owner then 'Rina Wijaya' else 'Budi Santoso' end,
    email = case id when v_owner then 'owner@demo.relasi.test' else 'sales@demo.relasi.test' end
  where id in (v_owner, v_sales);

  -- Wipe the workspace's records (memberships and AI usage stay).
  delete from public.activities where org_id = v_org;
  delete from public.deals where org_id = v_org;
  delete from public.contacts where org_id = v_org;
  delete from public.companies where org_id = v_org;
  delete from public.pipeline_stages where org_id = v_org;
  delete from public.invitations where org_id = v_org;
  delete from public.billing_orders where org_id = v_org;

  insert into public.organizations (id, name, plan, is_demo)
  values (v_org, 'Sinar Digital Agency (demo)', 'free', true)
  on conflict (id) do update set name = excluded.name, plan = 'free', plan_expires_at = null, is_demo = true;

  -- Memberships: exactly the two demo accounts, with fixed roles.
  delete from public.memberships where org_id = v_org and user_id not in (v_owner, v_sales);
  insert into public.memberships (org_id, user_id, role) values (v_org, v_owner, 'owner'), (v_org, v_sales, 'sales')
  on conflict (org_id, user_id) do update set role = excluded.role;

  insert into public.pipeline_stages (org_id, name, position, probability, kind) values
    (v_org, 'Lead', 0, 10, 'open'), (v_org, 'Qualified', 1, 25, 'open'),
    (v_org, 'Proposal', 2, 50, 'open'), (v_org, 'Negotiation', 3, 75, 'open'),
    (v_org, 'Won', 4, 100, 'won'), (v_org, 'Lost', 5, 0, 'lost');
  select id into s_lead from public.pipeline_stages where org_id = v_org and position = 0;
  select id into s_qual from public.pipeline_stages where org_id = v_org and position = 1;
  select id into s_prop from public.pipeline_stages where org_id = v_org and position = 2;
  select id into s_nego from public.pipeline_stages where org_id = v_org and position = 3;
  select id into s_won from public.pipeline_stages where org_id = v_org and position = 4;
  select id into s_lost from public.pipeline_stages where org_id = v_org and position = 5;

  insert into public.companies (org_id, name, domain, industry, created_by) values
    (v_org, 'Kopi Senja Nusantara', 'kopisenja.example.com', 'Food & beverage', v_owner),
    (v_org, 'Batik Larasati', 'larasati.example.com', 'Fashion retail', v_owner),
    (v_org, 'Klinik Gigi Ceria', 'gigiceria.example.com', 'Healthcare', v_sales),
    (v_org, 'CV Arunika Logistik', 'arunika.example.com', 'Logistics', v_owner),
    (v_org, 'Griya Bangun Sentosa', 'griyabangun.example.com', 'Building materials', v_sales),
    (v_org, 'Sekolah Tunas Harapan', 'tunasharapan.example.com', 'Education', v_owner),
    (v_org, 'Warung Bu Tini Catering', null, 'Catering', v_sales);

  -- Contacts: (name, email, phone, title, company, status, source, owner, notes)
  for c in
    select * from (values
      ('Dewi Lestari', 'dewi@kopisenja.example.com', '0812-0000-1001', 'Owner', 'Kopi Senja Nusantara', 'qualified', 'referral', v_owner,
        'Runs 3 coffee shops in Semarang, opening a 4th in Q1. Wants a loyalty program and Instagram ads.'),
      ('Arif Nugroho', 'arif@kopisenja.example.com', '0812-0000-1002', 'Marketing lead', 'Kopi Senja Nusantara', 'lead', 'referral', v_sales,
        'Handles day-to-day social media. Prefers WhatsApp.'),
      ('Sari Larasati', 'sari@larasati.example.com', '0812-0000-1003', 'Founder', 'Batik Larasati', 'customer', 'website', v_owner,
        'Long-time customer. Monthly retainer for marketplace listings since March.'),
      ('dr. Maya Putri', 'maya@gigiceria.example.com', '0812-0000-1004', 'Clinic director', 'Klinik Gigi Ceria', 'qualified', 'website', v_sales,
        'Needs an online booking page and Google Business profile cleanup. Budget approved by partners.'),
      ('Hendra Gunawan', 'hendra@arunika.example.com', '0812-0000-1005', 'Operations manager', 'CV Arunika Logistik', 'lead', 'whatsapp', v_sales,
        'Asked about a shipment tracking page for B2B clients. Not the decision maker.'),
      ('Fitri Handayani', 'fitri@griyabangun.example.com', '0812-0000-1006', 'Owner', 'Griya Bangun Sentosa', 'lead', 'manual', v_sales,
        'Met at the UMKM expo. Interested but price sensitive.'),
      ('Yusuf Pratama', 'yusuf@tunasharapan.example.com', '0812-0000-1007', 'Head of admissions', 'Sekolah Tunas Harapan', 'qualified', 'referral', v_owner,
        'New admissions season starts in January; wants a landing page and lead form before December.'),
      ('Tini Rahayu', null, '0812-0000-1008', 'Owner', 'Warung Bu Tini Catering', 'churned', 'whatsapp', v_sales,
        'Paused the catalogue project after a slow quarter. Open to restart next year.'),
      ('Rudi Hartono', 'rudi@example.com', '0812-0000-1009', 'Freelance consultant', null, 'lead', 'other', v_sales,
        'Could refer several F&B clients.')
    ) as t (full_name, email, phone, title, company, status, source, owner_id, notes)
  loop
    insert into public.contacts (org_id, company_id, full_name, email, phone, title, status, source, owner_id, notes, created_at)
    values (
      v_org, (select co.id from public.companies co where co.org_id = v_org and co.name = c.company),
      c.full_name, c.email, c.phone, c.title, c.status, c.source, c.owner_id, c.notes,
      now() - (random() * interval '60 days')
    );
  end loop;

  -- Deals: (title, value, stage, contact, owner, position, expected close / closed days ago)
  insert into public.deals (org_id, title, value, stage_id, contact_id, company_id, owner_id, position, expected_close, closed_at)
  select v_org, d.title, d.value, d.stage_id, ct.id, ct.company_id, d.owner_id, d.position,
    case when d.days > 0 then current_date + d.days end,
    case when d.days < 0 then now() + make_interval(days => d.days) end
  from (values
    ('Kopi Senja: loyalty app + ads', 45000000::bigint, s_nego, 'Dewi Lestari', v_owner, 1.0::float8, 14),
    ('Kopi Senja: 4th outlet launch campaign', 18000000, s_prop, 'Arif Nugroho', v_sales, 1, 30),
    ('Klinik Gigi Ceria: booking site', 32000000, s_prop, 'dr. Maya Putri', v_sales, 2, 21),
    ('Arunika: B2B tracking page', 27500000, s_lead, 'Hendra Gunawan', v_sales, 1, 60),
    ('Griya Bangun: product catalogue', 12000000, s_qual, 'Fitri Handayani', v_sales, 1, 45),
    ('Tunas Harapan: admissions landing page', 22000000, s_qual, 'Yusuf Pratama', v_owner, 2, 25),
    ('Referral partnership', 5000000, s_lead, 'Rudi Hartono', v_sales, 2, 90),
    ('Batik Larasati: marketplace retainer', 36000000, s_won, 'Sari Larasati', v_owner, 1, -40),
    ('Batik Larasati: Lebaran campaign', 15000000, s_won, 'Sari Larasati', v_owner, 2, -12),
    ('Tunas Harapan: open-day video', 9000000, s_won, 'Yusuf Pratama', v_owner, 3, -70),
    ('Bu Tini: online catalogue', 8000000, s_lost, 'Tini Rahayu', v_sales, 1, -25),
    ('Arunika: fleet dashboard', 60000000, s_lost, 'Hendra Gunawan', v_owner, 2, -55)
  ) as d (title, value, stage_id, contact_name, owner_id, position, days)
  join public.contacts ct on ct.org_id = v_org and ct.full_name = d.contact_name;

  -- Activities: interaction history (what the AI summary reads) and open tasks.
  insert into public.activities (org_id, kind, subject, body, contact_id, deal_id, due_at, completed_at, owner_id, created_at)
  select v_org, a.kind, a.subject, a.body, ct.id,
    (select dl.id from public.deals dl where dl.org_id = v_org and dl.contact_id = ct.id order by dl.position limit 1),
    case when a.due_days is not null then now() + make_interval(days => a.due_days) end,
    case when a.done then a.happened_at end,
    a.owner_id, a.happened_at
  from (
    -- Each interaction lands in Jakarta working hours (08:30-17:30), at a time fixed by its subject,
    -- so the history does not show every entry at the minute the demo was last reset.
    select v.*, ((now() at time zone 'Asia/Jakarta')::date - v.ago + time '08:30'
      + make_interval(mins => abs(hashtext(v.subject)) % 540)) at time zone 'Asia/Jakarta' as happened_at
    from (values
    ('Dewi Lestari', 'meeting', 'Discovery meeting at the Pandanaran outlet',
      'Walked through current sales: ~600 cups/day across 3 outlets. Repeat customers are ~40%. She wants a points-based loyalty program and ads for the new outlet. Decision with her husband (co-owner).',
      null::int, true, 21, v_owner),
    ('Dewi Lestari', 'email', 'Sent proposal v1', 'Proposal Rp52jt: loyalty web app + 3 months of ads management.', null, true, 14, v_owner),
    ('Dewi Lestari', 'whatsapp', 'Feedback on proposal',
      'Likes the scope, asks for a lower price. Competitor quoted Rp40jt without ads. Open to dropping the custom app for a ready-made loyalty tool.',
      null, true, 6, v_owner),
    ('Dewi Lestari', 'task', 'Send revised proposal (Rp45jt option)', null, 1, false, 2, v_owner),
    ('dr. Maya Putri', 'call', 'Intro call', 'Clinic gets ~30% of bookings by phone after hours and misses them. Wants online booking with WhatsApp reminders.', null, true, 18, v_sales),
    ('dr. Maya Putri', 'meeting', 'Demo of booking prototype', 'Partners liked it. Budget Rp30-35jt approved. Needs go-live before the new branch opens in 6 weeks.', null, true, 5, v_sales),
    ('dr. Maya Putri', 'task', 'Follow up on signed quotation', null, -2, false, 4, v_sales),
    ('Hendra Gunawan', 'whatsapp', 'Inbound question', 'Asked if we build tracking pages. Mentioned the director decides on budgets. No timeline yet.', null, true, 9, v_sales),
    ('Fitri Handayani', 'note', 'Expo follow-up', 'Interested in a catalogue site but asked twice about cheaper options. Sells cement, ceramics, and paint.', null, true, 11, v_sales),
    ('Fitri Handayani', 'task', 'Send portfolio of catalogue sites', null, -5, false, 8, v_sales),
    ('Yusuf Pratama', 'meeting', 'Admissions planning', 'Target 120 new students. Last year leads came from Instagram and walk-ins. Wants lead form + WhatsApp auto-reply.', null, true, 10, v_owner),
    ('Yusuf Pratama', 'task', 'Draft landing page wireframe', null, 3, false, 1, v_owner),
    ('Sari Larasati', 'call', 'Monthly retainer review', 'Marketplace sales up 18% month on month. Happy with the work; asked about a Lebaran campaign again next year.', null, true, 3, v_owner),
    ('Tini Rahayu', 'whatsapp', 'Project paused', 'Slow quarter, cash flow tight. Asked us to check back in January.', null, true, 25, v_sales),
    ('Rudi Hartono', 'note', 'Coffee chat', 'Works with ~10 F&B owners. Proposed a 10% referral fee.', null, true, 7, v_sales)
    ) as v (contact_name, kind, subject, body, due_days, done, ago, owner_id)
  ) as a
  join public.contacts ct on ct.org_id = v_org and ct.full_name = a.contact_name;

  -- The rebuild itself is not something a visitor did.
  delete from public.audit_log where org_id = v_org;
end;
$$;

revoke all on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.reset_demo() to service_role;
