-- Phase 12 follow-up: schema-guardian review fixes for 20260530012540_protocols.sql.
--   1. Tighten compound_dose_reference read to authenticated (parity with `compounds`).
--   2. Bound reconstitution_records.insulin_units (<= 1000) to match the Zod cap.
--   3. Add the missing FK/RLS lookup indexes on protocol_schedule_weeks.

-- 1. Parity with compounds: authenticated read only (no anon).
drop policy if exists compound_dose_reference_select on compound_dose_reference;
create policy compound_dose_reference_select on compound_dose_reference
  for select using (auth.role() = 'authenticated');

-- 2. Sane upper bound on insulin units (a real syringe never exceeds ~100u/dose;
--    1000 leaves generous headroom while preventing absurd stored values).
alter table reconstitution_records
  drop constraint if exists reconstitution_records_insulin_units_check;
alter table reconstitution_records
  add constraint reconstitution_records_insulin_units_check
    check (insulin_units is null or (insulin_units >= 0 and insulin_units <= 1000));

-- 3. RLS + compound-detail lookup indexes.
create index if not exists protocol_schedule_weeks_user_idx
  on protocol_schedule_weeks(user_id, created_at desc);
create index if not exists protocol_schedule_weeks_compound_idx
  on protocol_schedule_weeks(compound_id);
