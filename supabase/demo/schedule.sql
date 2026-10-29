-- Run once on the hosted demo project (SQL editor): rebuilds the demo
-- workspace at the top of every hour. Not a migration, because local and CI
-- databases should not reset themselves.
create extension if not exists pg_cron;
select cron.schedule('relasi-reset-demo', '0 * * * *', $$select public.reset_demo()$$);
