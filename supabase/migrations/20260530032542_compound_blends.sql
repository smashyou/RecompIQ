-- Phase 15: named multi-peptide blends (e.g. KLOW, GLOW, Wolverine).
--
-- Blends are community/vendor combinations of existing catalog compounds —
-- NOT single peptides and NOT FDA-approved. We model them as `compounds` rows
-- flagged is_blend=true, with `component_slugs` pointing at their constituent
-- compounds. A blend carries NO combined-product dose (none is established);
-- its cautions are the UNION of its components' cautions, computed at render.
--
-- Purely additive: two new columns with safe defaults. Existing rows unaffected.

alter table compounds
  add column if not exists is_blend       boolean not null default false,
  add column if not exists component_slugs text[]  not null default '{}';

-- DOWN (run manually to reverse):
--   alter table compounds drop column if exists is_blend, drop column if exists component_slugs;
