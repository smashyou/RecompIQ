-- 0001_init.sql
-- Foundation: enums, profiles, goals, conditions, medications, injuries.
-- All user-scoped tables ship with RLS enabled and matching policies.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------
do $$ begin
  create type sex_t as enum ('male','female','intersex','prefer_not_to_say');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_phase_t as enum ('P1','P2','P3','plateau','maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_weight_t as enum ('lb','kg');
exception when duplicate_object then null; end $$;

do $$ begin
  create type unit_length_t as enum ('in','cm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evidence_t as enum (
    'FDA_APPROVED','HUMAN_RCT','HUMAN_OBS','ANIMAL','MECHANISTIC','ANECDOTAL'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type route_t as enum ('sc','im','iv','oral','nasal','topical','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type adherence_t as enum ('taken','skipped','partial','unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_severity_t as enum ('info','warn','critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_kind_t as enum (
    'rapid_weight_loss','low_protein','severe_nausea','dehydration',
    'glucose_high','glucose_low','bp_high','bp_low',
    'neuro_worsening','side_effect_cluster','unsafe_stack','adherence_drop'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type vision_provider_t as enum ('openai','google','anthropic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type log_source_t as enum ('manual','photo','barcode','api','imported');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  display_name    text,
  dob             date,
  sex             sex_t not null default 'prefer_not_to_say',
  height_in       numeric(5,2) check (height_in is null or (height_in between 36 and 96)),
  unit_weight     unit_weight_t not null default 'lb',
  unit_length     unit_length_t not null default 'in',
  is_demo         boolean not null default false,
  onboarding_done boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

alter table profiles enable row level security;

create policy profiles_select on profiles for select
  using (auth.uid() = user_id);
create policy profiles_insert on profiles for insert
  with check (auth.uid() = user_id);
create policy profiles_update on profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy profiles_delete on profiles for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------
create table if not exists goals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  start_weight_lb       numeric(5,2) not null check (start_weight_lb between 50 and 800),
  goal_weight_lb_min    numeric(5,2) not null check (goal_weight_lb_min between 50 and 800),
  goal_weight_lb_max    numeric(5,2) not null check (goal_weight_lb_max between 50 and 800),
  timeline_weeks        int not null check (timeline_weeks between 1 and 260),
  phase                 goal_phase_t not null default 'P1',
  protein_target_g_min  int not null check (protein_target_g_min between 20 and 400),
  protein_target_g_max  int not null check (protein_target_g_max between 20 and 400),
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (goal_weight_lb_min <= goal_weight_lb_max),
  check (protein_target_g_min <= protein_target_g_max)
);

create index if not exists goals_user_idx on goals(user_id);

create trigger goals_set_updated_at
  before update on goals
  for each row execute function set_updated_at();

alter table goals enable row level security;

create policy goals_select on goals for select using (auth.uid() = user_id);
create policy goals_insert on goals for insert with check (auth.uid() = user_id);
create policy goals_update on goals for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy goals_delete on goals for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- conditions, medications, injuries (each many-per-user)
-- ---------------------------------------------------------------
create table if not exists conditions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  detail      text,
  diagnosed_at date,
  active      boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists conditions_user_idx on conditions(user_id);

create table if not exists medications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  dose        text,
  route       route_t,
  started_at  date,
  active      boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists medications_user_idx on medications(user_id);

create table if not exists injuries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  detail      text,
  occurred_at date,
  active      boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists injuries_user_idx on injuries(user_id);

alter table conditions   enable row level security;
alter table medications  enable row level security;
alter table injuries     enable row level security;

create policy conditions_select  on conditions  for select using (auth.uid() = user_id);
create policy conditions_insert  on conditions  for insert with check (auth.uid() = user_id);
create policy conditions_update  on conditions  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy conditions_delete  on conditions  for delete using (auth.uid() = user_id);

create policy medications_select on medications for select using (auth.uid() = user_id);
create policy medications_insert on medications for insert with check (auth.uid() = user_id);
create policy medications_update on medications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy medications_delete on medications for delete using (auth.uid() = user_id);

create policy injuries_select    on injuries    for select using (auth.uid() = user_id);
create policy injuries_insert    on injuries    for insert with check (auth.uid() = user_id);
create policy injuries_update    on injuries    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy injuries_delete    on injuries    for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Auto-create profile on new auth user
-- ---------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
