-- Phase 12: Reconstitution & Protocols hub.
--
-- Three additions:
--   1. compound_dose_reference — EDUCATIONAL literature dose ranges, kept in a
--      SEPARATE table from `compounds` (which stays dose-free by design). Every
--      row is evidence-graded + cited. This is reference material, NOT a
--      prescription: the UI renders it via <DoseAnnotatedText> + the clinician
--      disclaimer, and users override freely.
--   2. reconstitution_records gains the per-dose columns so a saved mix captures
--      the full calculation, not just the vial concentration.
--   3. protocol_schedules / protocol_schedule_weeks — user-built titration
--      timelines (week-by-week). Doses here are user/clinician-supplied.

-- ---------------------------------------------------------------------------
-- 1. Educational literature dose ranges (public read, admin-write only)
-- ---------------------------------------------------------------------------
create table if not exists compound_dose_reference (
  id              uuid primary key default gen_random_uuid(),
  compound_id     uuid not null references compounds(id) on delete cascade,
  context         text not null,                       -- e.g. "fat loss", "tissue repair", "titration start"
  route           route_t,
  low_value       numeric(10,3) check (low_value is null or low_value >= 0),
  high_value      numeric(10,3) check (high_value is null or high_value >= 0),
  unit            text not null check (unit in ('mg','mcg','iu','units','mg/kg','mcg/kg')),
  frequency       text,                                -- free-form: "weekly", "EOD", "2x/week"
  evidence_level  evidence_t not null,
  is_human_data   boolean not null default false,      -- false ⇒ animal/mechanistic only; UI must flag
  citation        jsonb not null default '[]'::jsonb,  -- [{ source, title, url, year }]
  notes           text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  check (low_value is null or high_value is null or high_value >= low_value)
);
create index if not exists compound_dose_reference_compound_idx
  on compound_dose_reference(compound_id);

alter table compound_dose_reference enable row level security;
-- Public read (same posture as `compounds`); writes are admin-only via service role.
create policy compound_dose_reference_select on compound_dose_reference
  for select using (true);

-- ---------------------------------------------------------------------------
-- 2. Extend reconstitution_records with the full per-dose calculation
-- ---------------------------------------------------------------------------
alter table reconstitution_records
  add column if not exists desired_dose_mg       numeric(10,4) check (desired_dose_mg is null or desired_dose_mg > 0),
  add column if not exists syringe_units_per_ml  int           check (syringe_units_per_ml is null or syringe_units_per_ml > 0),
  add column if not exists draw_ml               numeric(10,4) check (draw_ml is null or draw_ml > 0),
  add column if not exists insulin_units         numeric(10,2) check (insulin_units is null or insulin_units >= 0),
  add column if not exists vial_cost_usd         numeric(10,2) check (vial_cost_usd is null or vial_cost_usd >= 0),
  add column if not exists label                 text;

-- ---------------------------------------------------------------------------
-- 3. Protocol titration schedules (user-built, week-by-week)
-- ---------------------------------------------------------------------------
create table if not exists protocol_schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  stack_id    uuid references peptide_stacks(id) on delete set null,
  name        text not null,
  phase       goal_phase_t,
  start_on    date,
  notes       text,
  is_active   boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists protocol_schedules_user_idx
  on protocol_schedules(user_id, created_at desc);

alter table protocol_schedules enable row level security;
create policy protocol_schedules_select on protocol_schedules
  for select using (auth.uid() = user_id);
create policy protocol_schedules_insert on protocol_schedules
  for insert with check (auth.uid() = user_id);
create policy protocol_schedules_update on protocol_schedules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy protocol_schedules_delete on protocol_schedules
  for delete using (auth.uid() = user_id);

create table if not exists protocol_schedule_weeks (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references protocol_schedules(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  compound_id   uuid not null references compounds(id),
  week_number   int not null check (week_number >= 1 and week_number <= 104),
  dose_value    numeric(10,3) not null check (dose_value > 0),  -- user/clinician-supplied
  dose_unit     text not null check (dose_unit in ('mg','mcg','iu','ml','units')),
  route         route_t not null,
  frequency     text not null,
  notes         text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists protocol_schedule_weeks_schedule_idx
  on protocol_schedule_weeks(schedule_id, week_number);

alter table protocol_schedule_weeks enable row level security;
create policy protocol_schedule_weeks_select on protocol_schedule_weeks
  for select using (auth.uid() = user_id);
create policy protocol_schedule_weeks_insert on protocol_schedule_weeks
  for insert with check (auth.uid() = user_id);
create policy protocol_schedule_weeks_update on protocol_schedule_weeks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy protocol_schedule_weeks_delete on protocol_schedule_weeks
  for delete using (auth.uid() = user_id);

-- updated_at trigger for protocol_schedules (reuse the shared set_updated_at function)
do $$ begin
  create trigger protocol_schedules_touch
    before update on protocol_schedules
    for each row execute function set_updated_at();
exception when undefined_function then null; when duplicate_object then null; end $$;
