-- Idempotency ledger for the reminder cron. One row per (user, kind, day) the
-- cron successfully dispatched, so a re-run (Vercel retries, manual trigger)
-- never double-sends the same reminder on the same calendar day.
-- Written + read ONLY by the service-role cron (admin client bypasses RLS);
-- no policies are defined, so RLS denies all anon/authenticated access.

create table if not exists notification_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, sent_on)
);
create index if not exists notification_sends_user_idx on notification_sends(user_id);
alter table notification_sends enable row level security;
-- No policies: only the service-role cron writes/reads this (admin client bypasses RLS).
