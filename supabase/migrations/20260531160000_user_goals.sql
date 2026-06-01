-- Phase 4 of the Regimen redesign (docs/REGIMEN_GOALS_PRD.md §4.3/§3).
--
-- user_goals — the goals that drive what the app tracks, suggests, and projects.
-- Multiple per user, prioritized, status-tracked. goal_key is validated against
-- the shared GOAL_TAXONOMY at the app layer (Zod). Goals link to regimen phases
-- via the existing regimen_phases.goal_ids uuid[] column.
--
-- `target` jsonb holds per-goal targets (e.g. {"goal_weight_lb":195} for fat_loss)
-- — user-entered context, never a prescribed outcome.
--
-- RLS user-scoped. schema-guardian reviewed.

create table if not exists user_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  goal_key    text not null check (goal_key <> ''),
  priority    integer not null default 1 check (priority >= 1),
  status      text not null default 'active' check (status in ('active','queued','done')),
  target      jsonb not null default '{}'::jsonb,
  notes       text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, goal_key)
);
create index if not exists user_goals_user_idx on user_goals(user_id, priority);

create trigger user_goals_set_updated_at
  before update on user_goals
  for each row execute function set_updated_at();

alter table user_goals enable row level security;
create policy user_goals_select on user_goals for select using (auth.uid() = user_id);
create policy user_goals_insert on user_goals for insert with check (auth.uid() = user_id);
create policy user_goals_update on user_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_goals_delete on user_goals for delete using (auth.uid() = user_id);

-- regimen_phases.goal_ids is a uuid[] soft-link (Postgres can't FK array
-- elements). When a goal is deleted, strip its id from any of the user's phase
-- goal_ids arrays so no dangling ids linger (covers direct deletes too).
create or replace function remove_deleted_goal_from_phases()
returns trigger language plpgsql as $$
begin
  update regimen_phases
  set goal_ids = array_remove(goal_ids, old.id)
  where user_id = old.user_id
    and old.id = any(goal_ids);
  return old;
end;
$$;

drop trigger if exists user_goals_cleanup_phases on user_goals;
create trigger user_goals_cleanup_phases
  after delete on user_goals
  for each row execute function remove_deleted_goal_from_phases();

-- DOWN (run manually to reverse):
--   drop trigger if exists user_goals_cleanup_phases on user_goals;
--   drop function if exists remove_deleted_goal_from_phases();
--   drop table if exists user_goals;
