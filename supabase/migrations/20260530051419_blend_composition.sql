-- Phase 15 follow-up: store blend composition (per-component mg) + a typical
-- vial size so the calculator can be peptide/blend-specific.
--
-- component_mg holds the factual milligram amount of each ingredient in a blend,
-- e.g. KLOW = [{"label":"GHK-Cu","mg":50},{"label":"BPC-157","mg":10},...].
-- typical_vial_mg is the common research vial size (for blends, the combined
-- total) used to pre-fill the reconstitution calculator.

alter table compounds
  add column if not exists component_mg     jsonb   not null default '[]'::jsonb,
  add column if not exists typical_vial_mg  numeric check (typical_vial_mg is null or typical_vial_mg > 0);

-- DOWN (run manually to reverse):
--   alter table compounds drop column if exists component_mg, drop column if exists typical_vial_mg;
