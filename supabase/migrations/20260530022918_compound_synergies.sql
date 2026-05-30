-- Phase 13: per-compound synergy / stacking reference.
--
-- EDUCATIONAL "commonly combined with…" data: each row links a catalog compound
-- to another compound (by name, and by FK when it's also in our catalog) with a
-- sourced/pharmacologic RATIONALE, an evidence grade, and caution notes. This is
-- reference material for clinician discussion — NOT a prescription or a
-- recommended protocol. The UI renders it with the clinician disclaimer and
-- runs contraindication checks; it never instructs the user to combine anything.

create table if not exists compound_synergies (
  id                  uuid primary key default gen_random_uuid(),
  compound_id         uuid not null references compounds(id) on delete cascade,
  paired_name         text not null,                 -- partner name (always set)
  paired_compound_id  uuid references compounds(id) on delete set null, -- set when partner is in our catalog
  rationale           text not null,                 -- educational mechanism/why-combined
  evidence_level      evidence_t not null,
  is_human_data       boolean not null default false,
  caution_notes       text,
  citation            jsonb not null default '[]'::jsonb,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists compound_synergies_compound_idx
  on compound_synergies(compound_id);
create index if not exists compound_synergies_paired_idx
  on compound_synergies(paired_compound_id) where paired_compound_id is not null;

alter table compound_synergies enable row level security;
-- Authenticated read (parity with compounds + compound_dose_reference).
-- Writes are admin-only via the service role.
create policy compound_synergies_select on compound_synergies
  for select using (auth.role() = 'authenticated');

-- DOWN (run manually to reverse this migration):
--   drop table if exists compound_synergies;
