-- Phase 6 of the Regimen redesign (docs/REGIMEN_GOALS_PRD.md §4.4).
--
-- lab_results — a user's own biomarker readings, entered manually or read from a
-- lab-report photo/PDF via vision OCR (reuses the feature='vision' gateway +
-- Vercel Blob). One row per marker per draw. marker_key is validated app-side
-- against the shared LAB_MARKER catalog; raw `marker` is always kept verbatim.
-- ref_low/ref_high hold the REPORT'S printed range when available; the app falls
-- back to a catalog range for highlighting. Nothing here is a diagnosis — the UI
-- flags out-of-range values for clinician discussion only, never interprets them.
--
-- RLS user-scoped. schema-guardian reviewed.

create table if not exists lab_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  panel        text,                          -- catalog panel (metabolic, lipids, cbc…)
  marker       text not null check (marker <> ''), -- display name, raw or catalog label
  marker_key   text,                          -- catalog key when recognized, else null
  value        numeric not null,
  unit         text,
  ref_low      numeric,                        -- report's printed range low (if shown)
  ref_high     numeric,                        -- report's printed range high (if shown)
  collected_on date not null default current_date,
  source       text not null default 'manual'
                 check (source in ('manual','ocr')),
  photo_url    text,                           -- Blob URL of the source report (ocr)
  ocr_raw      jsonb,                          -- full parser output for provenance/audit
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists lab_results_user_marker_idx
  on lab_results(user_id, marker_key, collected_on desc);
create index if not exists lab_results_user_collected_idx
  on lab_results(user_id, collected_on desc);

alter table lab_results enable row level security;
create policy lab_results_select on lab_results for select using (auth.uid() = user_id);
create policy lab_results_insert on lab_results for insert with check (auth.uid() = user_id);
create policy lab_results_update on lab_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lab_results_delete on lab_results for delete using (auth.uid() = user_id);

-- DOWN (run manually to reverse):
--   drop table if exists lab_results;
