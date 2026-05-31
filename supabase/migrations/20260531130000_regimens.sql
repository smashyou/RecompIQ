-- Phase 1 of the goal-driven Regimen redesign (docs/REGIMEN_GOALS_PRD.md §4.1).
--
-- Introduces the single living "regimen" as the primary object, replacing the
-- multi-"stack" model that produced confusing duplicate "Phase 1" cards. Folds
-- each user's existing peptide_stacks into ONE regimen with one ORDERED phase
-- per stack (active stack = current phase), maps items 1:1, seeds the
-- append-only change log, and back-links existing peptide_doses to their new
-- regimen_item.
--
-- 1:1 MAPPING TRICK: a backfilled regimen_phase REUSES its source stack's uuid
-- as its own primary key, and a regimen_item REUSES its source stack_item's
-- uuid. This makes the fold deterministic + idempotent (on conflict do nothing)
-- and lets us back-link doses with `regimen_item_id = stack_item_id` directly.
--
-- SAFETY: items carry only user/clinician-supplied dose values copied verbatim
-- from peptide_stack_items. No doses are fabricated. The app does not prescribe.
-- Dose fields are nullable (null = unknown, never a fake number).
--
-- REVERSIBLE: legacy peptide_stacks / peptide_stack_items are left fully intact
-- (frozen, read-only by convention — the app stops writing them after cutover).
-- The manual DOWN block at the bottom drops the four new tables + the new
-- peptide_doses column to roll back cleanly; legacy data is untouched.
--
-- schema-guardian reviewed. RLS user-scoped on every new table.

-- ---------------------------------------------------------------
-- change-kind enum for the regimen_changes spine
-- ---------------------------------------------------------------
do $$ begin
  create type regimen_change_kind_t as enum (
    'add','edit','stop','dose_change','phase_advance','phase_add'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------
-- regimens — one living protocol per user (history retained via is_active)
-- ---------------------------------------------------------------
create table if not exists regimens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'My Regimen',
  is_active   boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists regimens_user_idx on regimens(user_id, is_active);
-- at most one active regimen per user
create unique index if not exists regimens_one_active_per_user
  on regimens(user_id) where is_active;

create trigger regimens_set_updated_at
  before update on regimens
  for each row execute function set_updated_at();

alter table regimens enable row level security;
create policy regimens_select on regimens for select using (auth.uid() = user_id);
create policy regimens_insert on regimens for insert with check (auth.uid() = user_id);
create policy regimens_update on regimens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy regimens_delete on regimens for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- regimen_phases — sequential time segments of a regimen.
-- Replaces the per-stack "phase" string; you can never have two "P1" cards.
-- ---------------------------------------------------------------
create table if not exists regimen_phases (
  id           uuid primary key default gen_random_uuid(),
  regimen_id   uuid not null references regimens(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  ordinal      integer not null default 1,
  name         text not null,
  legacy_phase goal_phase_t,                       -- retained P1/P2/P3 tag from the folded stack
  goal_ids     uuid[] not null default '{}',       -- populated once the goal model lands (PRD §4.3)
  starts_on    date,
  ends_on      date,                               -- null = current phase
  notes        text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists regimen_phases_regimen_idx on regimen_phases(regimen_id, ordinal);
create index if not exists regimen_phases_user_idx on regimen_phases(user_id);

create trigger regimen_phases_set_updated_at
  before update on regimen_phases
  for each row execute function set_updated_at();

alter table regimen_phases enable row level security;
create policy regimen_phases_select on regimen_phases for select using (auth.uid() = user_id);
create policy regimen_phases_insert on regimen_phases for insert with check (auth.uid() = user_id);
create policy regimen_phases_update on regimen_phases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy regimen_phases_delete on regimen_phases for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- regimen_items — a compound (or blend; blends are compounds rows) in a phase.
-- DOSE VALUES ARE USER/CLINICIAN-SUPPLIED. The app does NOT prescribe.
-- Dose fields nullable: an item may exist before a dose is decided.
-- ---------------------------------------------------------------
create table if not exists regimen_items (
  id           uuid primary key default gen_random_uuid(),
  regimen_id   uuid not null references regimens(id) on delete cascade,
  phase_id     uuid not null references regimen_phases(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  compound_id  uuid not null references compounds(id) on delete restrict,
  dose_value   numeric(8,3) check (dose_value is null or dose_value > 0),
  dose_unit    text check (dose_unit is null or dose_unit in ('mg','mcg','iu','ml','units')),
  route        route_t,
  frequency    text,
  schedule_id  uuid references protocol_schedules(id) on delete set null,
  source       text not null default 'user' check (source in ('user','clinician','ai_suggested')),
  starts_on    date,
  ends_on      date,                               -- null = still active
  notes        text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists regimen_items_regimen_idx on regimen_items(regimen_id);
create index if not exists regimen_items_phase_idx on regimen_items(phase_id);
create index if not exists regimen_items_compound_idx on regimen_items(compound_id);
create index if not exists regimen_items_user_idx on regimen_items(user_id);

create trigger regimen_items_set_updated_at
  before update on regimen_items
  for each row execute function set_updated_at();

alter table regimen_items enable row level security;
create policy regimen_items_select on regimen_items for select using (auth.uid() = user_id);
create policy regimen_items_insert on regimen_items for insert with check (auth.uid() = user_id);
create policy regimen_items_update on regimen_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy regimen_items_delete on regimen_items for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- regimen_changes — append-only versioning spine. Makes adherence + projections
-- honest about what was active when. Never updated, only inserted.
-- ---------------------------------------------------------------
create table if not exists regimen_changes (
  id           uuid primary key default gen_random_uuid(),
  regimen_id   uuid not null references regimens(id) on delete cascade,
  item_id      uuid references regimen_items(id) on delete set null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         regimen_change_kind_t not null,
  before       jsonb,
  after        jsonb,
  effective_on date not null default current_date,
  created_at   timestamptz not null default now()
);
create index if not exists regimen_changes_regimen_idx on regimen_changes(regimen_id, effective_on desc);
create index if not exists regimen_changes_item_idx on regimen_changes(item_id);

alter table regimen_changes enable row level security;
create policy regimen_changes_select on regimen_changes for select using (auth.uid() = user_id);
create policy regimen_changes_insert on regimen_changes for insert with check (auth.uid() = user_id);
-- append-only: no update / delete policies (immutable audit trail)

-- ---------------------------------------------------------------
-- peptide_doses gets a regimen_item back-reference (stack_item_id kept for rollback)
-- ---------------------------------------------------------------
alter table peptide_doses
  add column if not exists regimen_item_id uuid references regimen_items(id) on delete set null;
create index if not exists peptide_doses_regimen_item_idx on peptide_doses(regimen_item_id);

-- ===============================================================
-- BACKFILL — fold existing stacks into regimens (idempotent)
-- ===============================================================

-- 1. One regimen per user that has any stack and no regimen yet.
insert into regimens (user_id, title, is_active, is_demo, created_at)
select
  s.user_id,
  'My Regimen',
  bool_or(s.is_active),
  bool_or(s.is_demo),
  min(s.created_at)
from peptide_stacks s
where not exists (select 1 from regimens r where r.user_id = s.user_id)
group by s.user_id;

-- 2. One phase per stack, ordered by start. Phase id REUSES the stack id (1:1 map).
insert into regimen_phases (
  id, regimen_id, user_id, ordinal, name, legacy_phase, starts_on, ends_on, notes, is_demo, created_at
)
select
  s.id,
  r.id,
  s.user_id,
  row_number() over (
    partition by s.user_id
    order by coalesce(s.started_on, s.created_at::date), s.created_at, s.id
  ),
  s.name,
  s.phase,
  s.started_on,
  case when s.is_active then null else s.ended_on end,
  s.notes,
  s.is_demo,
  s.created_at
from peptide_stacks s
join regimens r on r.user_id = s.user_id
on conflict (id) do nothing;

-- 3. Items 1:1. Item id REUSES the stack_item id; phase_id = stack_id (= phase id).
insert into regimen_items (
  id, regimen_id, phase_id, user_id, compound_id,
  dose_value, dose_unit, route, frequency, source, starts_on, notes, is_demo, created_at
)
select
  si.id,
  r.id,
  si.stack_id,
  si.user_id,
  si.compound_id,
  si.dose_value,
  si.dose_unit,
  si.route,
  si.frequency,
  'user',
  s.started_on,
  si.notes,
  si.is_demo,
  si.created_at
from peptide_stack_items si
join peptide_stacks s on s.id = si.stack_id
join regimens r on r.user_id = si.user_id
on conflict (id) do nothing;

-- 4. Seed the change-log spine: one 'add' row per backfilled item.
insert into regimen_changes (regimen_id, item_id, user_id, kind, before, after, effective_on, created_at)
select
  ri.regimen_id,
  ri.id,
  ri.user_id,
  'add',
  null,
  jsonb_build_object(
    'compound_id', ri.compound_id,
    'dose_value',  ri.dose_value,
    'dose_unit',   ri.dose_unit,
    'route',       ri.route,
    'frequency',   ri.frequency
  ),
  coalesce(ri.starts_on, ri.created_at::date),
  ri.created_at
from regimen_items ri
where not exists (
  select 1 from regimen_changes c where c.item_id = ri.id and c.kind = 'add'
);

-- 5. Back-link existing doses (regimen_item.id == old stack_item.id by construction).
update peptide_doses d
set regimen_item_id = d.stack_item_id
where d.stack_item_id is not null
  and d.regimen_item_id is null
  and exists (select 1 from regimen_items ri where ri.id = d.stack_item_id);

-- ===============================================================
-- DOWN (run manually to reverse — legacy peptide_stacks/_items are untouched):
--   alter table peptide_doses drop column if exists regimen_item_id;
--   drop table if exists regimen_changes;
--   drop table if exists regimen_items;
--   drop table if exists regimen_phases;
--   drop table if exists regimens;
--   drop type if exists regimen_change_kind_t;
-- ===============================================================
