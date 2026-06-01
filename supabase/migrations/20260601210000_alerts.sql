-- Persisted safety alerts (PRD §8). Reconcile-on-load upserts by (user_id,
-- fingerprint). User-acknowledge/snooze; audited via the audit_row_change trigger.
-- Every alert is an observation for clinician discussion — never a prescription.

create table if not exists alerts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  kind             alert_kind_t not null,        -- canonical enum (init.sql); matches the 12 ALERT_KIND values
  severity         alert_severity_t not null,    -- info | warn | critical
  fingerprint      text not null,
  title            text not null,
  message          text not null,
  evidence         jsonb not null default '{}'::jsonb,
  evidence_level   text not null,
  citation         text not null,
  status           text not null default 'open' check (status in ('open','acknowledged','resolved')),
  first_detected_at timestamptz not null default now(),
  last_detected_at  timestamptz not null default now(),
  acknowledged_at   timestamptz,
  snoozed_until     timestamptz,
  resolved_at       timestamptz,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now()
);
-- One active row per (user, fingerprint); a resolved alert's fingerprint may recur
-- later as a fresh row. Lets reconcile upsert safely.
create unique index if not exists alerts_user_fingerprint_active_idx
  on alerts(user_id, fingerprint) where status <> 'resolved';
create index if not exists alerts_user_status_idx on alerts(user_id, status, severity);
create index if not exists alerts_user_last_detected_idx on alerts(user_id, last_detected_at desc);

alter table alerts enable row level security;
create policy alerts_select on alerts for select using (auth.uid() = user_id);
create policy alerts_insert on alerts for insert with check (auth.uid() = user_id);
create policy alerts_update on alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy alerts_delete on alerts for delete using (auth.uid() = user_id);

-- audited (audit_row_change from the audit_log migration)
drop trigger if exists audit_alerts on alerts;
create trigger audit_alerts after insert or update or delete on alerts
  for each row execute function audit_row_change();

-- DOWN (run manually to reverse):
--   drop trigger if exists audit_alerts on alerts;
--   drop index if exists alerts_user_last_detected_idx;
--   drop index if exists alerts_user_status_idx;
--   drop index if exists alerts_user_fingerprint_active_idx;
--   drop table if exists alerts;
