-- Phase 5 of the Regimen redesign (docs/REGIMEN_GOALS_PRD.md §4.3/§5.6).
--
-- goal_metrics — a generic, append-only metric time-series for goal tracking:
-- subjective 1–10 self-ratings (skin, focus, energy, libido, mood, pain…),
-- circumference (cm), and the cognition mini-test results (reaction ms, memory
-- score). Reuses weights/vitals/sleep_logs/symptoms where they already cover a
-- signal; this table holds the rest. metric_key is validated app-side against
-- the shared METRIC catalog. value is the user's own self-report — nothing here
-- is a clinical measurement or a prescription.
--
-- RLS user-scoped. schema-guardian reviewed.

create table if not exists goal_metrics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  metric_key  text not null check (metric_key <> ''),
  value       numeric not null,
  unit        text,                 -- 'rating', 'cm', 'ms', 'score'…
  goal_key    text,                 -- optional: which goal this serves
  logged_at   timestamptz not null default now(),
  note        text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists goal_metrics_user_metric_idx
  on goal_metrics(user_id, metric_key, logged_at desc);
create index if not exists goal_metrics_user_logged_idx
  on goal_metrics(user_id, logged_at desc);

alter table goal_metrics enable row level security;
create policy goal_metrics_select on goal_metrics for select using (auth.uid() = user_id);
create policy goal_metrics_insert on goal_metrics for insert with check (auth.uid() = user_id);
create policy goal_metrics_update on goal_metrics for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy goal_metrics_delete on goal_metrics for delete using (auth.uid() = user_id);

-- Goal-tagged photos: face/skin/hair shots live alongside physique shots so a
-- capture can serve skin / hair goals, not just body recomposition.
alter table body_photos
  add column if not exists kind     text not null default 'physique'
    check (kind in ('physique','face','skin','hair')),
  add column if not exists goal_key text;

-- DOWN (run manually to reverse):
--   alter table body_photos drop column if exists kind, drop column if exists goal_key;
--   drop table if exists goal_metrics;
