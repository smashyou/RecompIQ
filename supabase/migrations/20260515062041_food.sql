-- food_logs: per-user meal entries with denormalized macros.
-- We don't cache an external `foods` table for MVP — search always hits USDA/OFF live.
-- Macros are stored at the portion granularity the user actually ate, so historical
-- accuracy is preserved even if the upstream nutrition database later changes.

create table if not exists food_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  description     text not null,
  brand           text,
  source          text not null check (source in ('usda','openfoodfacts','nutritionix','custom')),
  source_id       text,
  amount          numeric(7,2) not null check (amount > 0),
  unit            text not null check (unit in ('g','oz','ml','cup','tbsp','tsp','serving','piece')),
  -- macros for THIS portion (not per-100g)
  calories_kcal   numeric(7,2) not null check (calories_kcal >= 0 and calories_kcal <= 10000),
  protein_g       numeric(6,2) not null check (protein_g >= 0 and protein_g <= 500),
  carbs_g         numeric(6,2) not null check (carbs_g >= 0 and carbs_g <= 1000),
  fat_g           numeric(6,2) not null check (fat_g >= 0 and fat_g <= 500),
  fiber_g         numeric(6,2) check (fiber_g >= 0 and fiber_g <= 200),
  sugar_g         numeric(6,2) check (sugar_g >= 0 and sugar_g <= 500),
  sodium_mg       numeric(7,2) check (sodium_mg >= 0 and sodium_mg <= 20000),
  meal_type       text check (meal_type in ('breakfast','lunch','dinner','snack')),
  logged_at       timestamptz not null default now(),
  log_source      log_source_t not null default 'manual',
  note            text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists food_logs_user_logged_at_idx on food_logs(user_id, logged_at desc);

alter table food_logs enable row level security;

create policy food_logs_select on food_logs for select using (auth.uid() = user_id);
create policy food_logs_insert on food_logs for insert with check (auth.uid() = user_id);
create policy food_logs_update on food_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy food_logs_delete on food_logs for delete using (auth.uid() = user_id);
