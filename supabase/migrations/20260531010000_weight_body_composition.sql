-- Body composition from smart scales (Arboleaf, Renpho, Withings, Eufy, …)
-- synced into Apple Health / Health Connect and imported by the mobile app.
-- Additive + nullable — existing manual weigh-ins are unaffected. Shared by web
-- and mobile (single Supabase). RLS already covers `weights` per-user.
alter table weights
  add column if not exists body_fat_pct numeric(4,1)
    check (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 80)),
  add column if not exists lean_mass_lb numeric(5,2)
    check (lean_mass_lb is null or (lean_mass_lb between 0 and 800));

-- DOWN (run manually to reverse):
--   alter table weights drop column if exists body_fat_pct, drop column if exists lean_mass_lb;
