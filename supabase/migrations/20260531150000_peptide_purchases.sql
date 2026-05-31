-- Phase 3 of the Regimen redesign (docs/REGIMEN_GOALS_PRD.md §4.2/§5.5).
--
-- Inventory & expenses: each vial purchase the user logs. Cost-per-dose and
-- spend are DERIVED at read time (FIFO depletion for "what's left + next-dose
-- cost"; weighted-average for dashboard + date-range summaries) — nothing about
-- dosing is prescribed here. price_usd is the TOTAL paid for the purchase
-- (vial_count vials); per-vial = price_usd / vial_count.
--
-- RLS user-scoped on every operation. schema-guardian reviewed.

create table if not exists peptide_purchases (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  compound_id   uuid not null references compounds(id) on delete restrict,
  vial_mg       numeric(10,3) not null check (vial_mg > 0),
  vial_count    integer not null default 1 check (vial_count > 0),
  price_usd     numeric(10,2) not null check (price_usd >= 0),
  vendor        text,
  purchased_on  date not null default current_date,
  notes         text,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists peptide_purchases_user_idx on peptide_purchases(user_id, purchased_on desc);
create index if not exists peptide_purchases_compound_idx on peptide_purchases(user_id, compound_id);

alter table peptide_purchases enable row level security;
create policy peptide_purchases_select on peptide_purchases for select using (auth.uid() = user_id);
create policy peptide_purchases_insert on peptide_purchases for insert with check (auth.uid() = user_id);
create policy peptide_purchases_update on peptide_purchases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy peptide_purchases_delete on peptide_purchases for delete using (auth.uid() = user_id);

-- DOWN (run manually to reverse):
--   drop table if exists peptide_purchases;
