-- Off-app alert notifications: stamp when an alert was notified (once), and
-- store Expo push tokens per device. RLS user-scoped.

alter table alerts add column if not exists notified_at timestamptz;
-- partial index: the dispatcher scans open, not-yet-notified alerts
create index if not exists alerts_user_unnotified_idx
  on alerts(user_id) where notified_at is null and status = 'open';

create table if not exists push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios','android')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index if not exists push_tokens_user_token_idx on push_tokens(user_id, token);
create index if not exists push_tokens_user_idx on push_tokens(user_id);

alter table push_tokens enable row level security;
create policy push_tokens_select on push_tokens for select using (auth.uid() = user_id);
create policy push_tokens_insert on push_tokens for insert with check (auth.uid() = user_id);
create policy push_tokens_update on push_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_tokens_delete on push_tokens for delete using (auth.uid() = user_id);

-- DOWN (run manually to reverse):
--   drop table if exists push_tokens;
--   drop index if exists alerts_user_unnotified_idx;
--   alter table alerts drop column if exists notified_at;
