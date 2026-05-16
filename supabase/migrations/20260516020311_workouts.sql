-- Workout tracking. Sessions + exercise rows + phase-aware templates.
-- mobility_sessions from the original schema is folded into workouts via
-- session_type so we keep one canonical table for "things I did today".

create table if not exists workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_type  text not null check (session_type in ('lifting','mobility','cardio','walking','mixed')),
  phase         goal_phase_t,
  date          date not null default current_date,
  duration_min  int check (duration_min between 0 and 480),
  perceived_exertion  int check (perceived_exertion between 1 and 10),
  template_slug text,
  name          text,
  notes         text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on workouts(user_id, date desc);

alter table workouts enable row level security;
create policy workouts_select on workouts for select using (auth.uid() = user_id);
create policy workouts_insert on workouts for insert with check (auth.uid() = user_id);
create policy workouts_update on workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workouts_delete on workouts for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- workout_exercises: rows within a session. Sets/reps/load are nullable so
-- mobility/walking entries can omit them.
-- ---------------------------------------------------------------
create table if not exists workout_exercises (
  id            uuid primary key default gen_random_uuid(),
  workout_id    uuid not null references workouts(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  order_index   int not null default 0,
  name          text not null,
  sets          int check (sets between 1 and 30),
  reps          int check (reps between 1 and 200),
  load_lb       numeric(6,2) check (load_lb >= 0 and load_lb <= 1500),
  duration_min  int check (duration_min between 0 and 480),
  rpe           int check (rpe between 1 and 10),
  notes         text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists workout_exercises_workout_idx on workout_exercises(workout_id, order_index);

alter table workout_exercises enable row level security;
create policy workout_exercises_select on workout_exercises for select using (auth.uid() = user_id);
create policy workout_exercises_insert on workout_exercises for insert with check (auth.uid() = user_id);
create policy workout_exercises_update on workout_exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workout_exercises_delete on workout_exercises for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- workout_templates: phase-aware templates, public read. Exercises stored
-- as a JSON array of { name, sets, reps, load_hint, duration_min, notes }.
-- ---------------------------------------------------------------
create table if not exists workout_templates (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  phase         goal_phase_t not null,
  session_type  text not null check (session_type in ('lifting','mobility','cardio','walking','mixed')),
  description   text not null,
  exercises     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists workout_templates_phase_idx on workout_templates(phase);

alter table workout_templates enable row level security;
create policy workout_templates_select on workout_templates for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- Template seed. Idempotent via slug.
-- Designed around Demo User A's P1 (deconditioned, no spinal load, foot weakness).
-- ---------------------------------------------------------------
insert into workout_templates (slug, name, phase, session_type, description, exercises) values
(
  'p1-walk-mobility', 'Walk + mobility (30 min)', 'P1', 'mixed',
  'Phase-1 baseline. Brisk walk + 5 mobility moves. Foot-drop friendly.',
  '[
    {"name":"Brisk walk","duration_min":20,"notes":"flat ground, comfortable pace"},
    {"name":"Cat-cow","sets":2,"reps":10},
    {"name":"World''s greatest stretch","sets":2,"reps":5,"notes":"each side"},
    {"name":"Standing hip flexor stretch","sets":2,"reps":1,"duration_min":1,"notes":"30s each side"},
    {"name":"Glute bridge","sets":2,"reps":12},
    {"name":"Banded clamshell","sets":2,"reps":12,"notes":"light band, each side"}
  ]'::jsonb
),
(
  'p1-banded-fullbody', 'Banded full-body (no spine loading)', 'P1', 'lifting',
  'Phase-1 strength foundation using resistance bands. Avoids axial load.',
  '[
    {"name":"Seated band row","sets":3,"reps":15},
    {"name":"Band chest press","sets":3,"reps":15},
    {"name":"Band lat pulldown","sets":3,"reps":15},
    {"name":"Band overhead press","sets":3,"reps":12},
    {"name":"Band squat (light)","sets":3,"reps":15,"notes":"only if comfortable; otherwise skip"},
    {"name":"Wall plank","sets":2,"reps":1,"duration_min":1,"notes":"30s hold each"}
  ]'::jsonb
),
(
  'p1-mobility-only', 'Mobility flow (15 min)', 'P1', 'mobility',
  'Recovery / off-day flow. Spinal-friendly mobility for hips, T-spine, ankles.',
  '[
    {"name":"Foam roll glutes","duration_min":2},
    {"name":"Foam roll quads","duration_min":2},
    {"name":"Thoracic spine rotation","sets":2,"reps":10},
    {"name":"90/90 hip rotation","sets":2,"reps":10},
    {"name":"Ankle circles","sets":2,"reps":10,"notes":"each direction, each side"},
    {"name":"Dead bug","sets":2,"reps":10}
  ]'::jsonb
),
(
  'p2-upper-machines', 'Upper body — machines', 'P2', 'lifting',
  'Phase-2 hypertrophy intro using machines (joint-friendly).',
  '[
    {"name":"Chest press machine","sets":3,"reps":10},
    {"name":"Seated row machine","sets":3,"reps":10},
    {"name":"Lat pulldown","sets":3,"reps":10},
    {"name":"Shoulder press machine","sets":3,"reps":10},
    {"name":"Cable triceps pushdown","sets":3,"reps":12},
    {"name":"Cable curl","sets":3,"reps":12}
  ]'::jsonb
),
(
  'p2-lower-machines', 'Lower body — machines', 'P2', 'lifting',
  'Phase-2 lower hypertrophy using machines. No barbell yet.',
  '[
    {"name":"Leg press","sets":3,"reps":10},
    {"name":"Leg curl machine","sets":3,"reps":10},
    {"name":"Leg extension","sets":3,"reps":12},
    {"name":"Hip abduction machine","sets":3,"reps":12},
    {"name":"Standing calf raise","sets":3,"reps":15},
    {"name":"Cable trunk rotation","sets":2,"reps":10,"notes":"each side"}
  ]'::jsonb
),
(
  'p2-cardio-intervals', 'Cardio intervals (Zone 2 + sprints)', 'P2', 'cardio',
  'Stationary bike or recumbent. 20 min Z2 + 4×1 min hard.',
  '[
    {"name":"Bike Z2","duration_min":20,"notes":"conversational pace"},
    {"name":"Interval 1 — hard","duration_min":1},
    {"name":"Recovery","duration_min":2,"notes":"easy spin"},
    {"name":"Interval 2 — hard","duration_min":1},
    {"name":"Recovery","duration_min":2},
    {"name":"Interval 3 — hard","duration_min":1},
    {"name":"Recovery","duration_min":2},
    {"name":"Interval 4 — hard","duration_min":1},
    {"name":"Cool-down","duration_min":5}
  ]'::jsonb
),
(
  'p3-upper-progressive', 'Upper — progressive overload', 'P3', 'lifting',
  'Phase-3 strength + hypertrophy. Compound first, progressive loading week-to-week.',
  '[
    {"name":"Incline DB press","sets":4,"reps":8},
    {"name":"Chest-supported row","sets":4,"reps":8},
    {"name":"Pull-ups (assisted as needed)","sets":3,"reps":8},
    {"name":"DB shoulder press","sets":3,"reps":10},
    {"name":"Triceps rope pushdown","sets":3,"reps":12},
    {"name":"Hammer curl","sets":3,"reps":12}
  ]'::jsonb
),
(
  'p3-lower-progressive', 'Lower — progressive overload', 'P3', 'lifting',
  'Phase-3 lower compound work. Goblet/trap-bar variants if barbell spinal loading still flagged.',
  '[
    {"name":"Goblet squat or trap-bar deadlift","sets":4,"reps":6,"notes":"avoid heavy barbell back squat per injury history"},
    {"name":"Romanian deadlift (DB)","sets":3,"reps":8},
    {"name":"Bulgarian split squat","sets":3,"reps":8,"notes":"each leg; reduce on weak side"},
    {"name":"Leg curl","sets":3,"reps":10},
    {"name":"Walking lunge","sets":3,"reps":10},
    {"name":"Calf raise","sets":3,"reps":15}
  ]'::jsonb
)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description,
  exercises = excluded.exercises;
