-- Daily logging tables: weights, vitals, symptoms, sleep, water, steps.
-- All user-scoped, RLS-enabled, bounded by medical-plausibility checks.
-- Used by /log (Phase 3) and read by the dashboard (Phase 2).

-- ---------------------------------------------------------------
-- weights
-- ---------------------------------------------------------------
create table if not exists weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  value_lb    numeric(5,2) not null check (value_lb between 50 and 800),
  logged_at   timestamptz not null default now(),
  source      log_source_t not null default 'manual',
  note        text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists weights_user_logged_at_idx on weights(user_id, logged_at desc);
alter table weights enable row level security;
create policy weights_select on weights for select using (auth.uid() = user_id);
create policy weights_insert on weights for insert with check (auth.uid() = user_id);
create policy weights_update on weights for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy weights_delete on weights for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- vitals
-- ---------------------------------------------------------------
create table if not exists vitals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  logged_at     timestamptz not null default now(),
  bp_systolic   int check (bp_systolic between 40 and 260),
  bp_diastolic  int check (bp_diastolic between 20 and 180),
  hr            int check (hr between 20 and 240),
  glucose_mgdl  numeric(5,1) check (glucose_mgdl between 20 and 1000),
  ketones_mmol  numeric(4,2) check (ketones_mmol between 0 and 10),
  temp_f        numeric(5,2) check (temp_f between 85 and 110),
  note          text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists vitals_user_logged_at_idx on vitals(user_id, logged_at desc);
alter table vitals enable row level security;
create policy vitals_select on vitals for select using (auth.uid() = user_id);
create policy vitals_insert on vitals for insert with check (auth.uid() = user_id);
create policy vitals_update on vitals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy vitals_delete on vitals for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- symptoms
-- ---------------------------------------------------------------
create table if not exists symptoms (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  logged_at     timestamptz not null default now(),
  mood          int check (mood between 1 and 5),
  energy        int check (energy between 1 and 5),
  pain          int check (pain between 0 and 10),
  appetite      int check (appetite between 1 and 5),
  nausea        boolean,
  reflux        boolean,
  constipation  boolean,
  neuro_note    text,
  note          text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists symptoms_user_logged_at_idx on symptoms(user_id, logged_at desc);
alter table symptoms enable row level security;
create policy symptoms_select on symptoms for select using (auth.uid() = user_id);
create policy symptoms_insert on symptoms for insert with check (auth.uid() = user_id);
create policy symptoms_update on symptoms for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy symptoms_delete on symptoms for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- sleep_logs — one per night
-- ---------------------------------------------------------------
create table if not exists sleep_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  night_of      date not null,
  bedtime       timestamptz,
  wake_time     timestamptz,
  duration_min  int check (duration_min between 0 and 1440),
  quality       int check (quality between 1 and 5),
  note          text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, night_of)
);
create index if not exists sleep_user_night_idx on sleep_logs(user_id, night_of desc);
alter table sleep_logs enable row level security;
create policy sleep_logs_select on sleep_logs for select using (auth.uid() = user_id);
create policy sleep_logs_insert on sleep_logs for insert with check (auth.uid() = user_id);
create policy sleep_logs_update on sleep_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sleep_logs_delete on sleep_logs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- water_logs
-- ---------------------------------------------------------------
create table if not exists water_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  logged_at   timestamptz not null default now(),
  volume_oz   numeric(5,1) not null check (volume_oz between 0 and 500),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists water_user_logged_at_idx on water_logs(user_id, logged_at desc);
alter table water_logs enable row level security;
create policy water_logs_select on water_logs for select using (auth.uid() = user_id);
create policy water_logs_insert on water_logs for insert with check (auth.uid() = user_id);
create policy water_logs_update on water_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy water_logs_delete on water_logs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- steps_logs — one per day
-- ---------------------------------------------------------------
create table if not exists steps_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  count       int not null check (count between 0 and 100000),
  source      log_source_t not null default 'manual',
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, day)
);
create index if not exists steps_user_day_idx on steps_logs(user_id, day desc);
alter table steps_logs enable row level security;
create policy steps_logs_select on steps_logs for select using (auth.uid() = user_id);
create policy steps_logs_insert on steps_logs for insert with check (auth.uid() = user_id);
create policy steps_logs_update on steps_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy steps_logs_delete on steps_logs for delete using (auth.uid() = user_id);
