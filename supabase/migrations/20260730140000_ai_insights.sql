-- Daily AI insights (audit item P0 #3).
--
-- Until now the "Coach insight" card on the dashboard was a hardcoded
-- two-sentence template in components/dashboard/derive.ts — weight trend plus
-- protein over/under, never mentioning peptides, workouts, labs, conditions or
-- injuries. `ai_insights` was specified in MILESTONES and never built, while the
-- admin panel advertised a "Daily insights — cron-generated dashboard cards"
-- toggle for a feature that did not exist. This is that table.
--
-- Rows are written ONLY by the service role (the generator runs off-platform on
-- the VPS and posts through /api/cron/insights, which runs the checkInsight
-- guard from @peptide/peptides/insights before writing). The user can read and
-- dismiss their own rows; they can never insert one, so nothing can bypass the
-- guard by writing directly from the client.

create table if not exists ai_insights (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  -- The user-local day this insight describes. One insight per user per day;
  -- a re-run overwrites rather than stacking duplicate cards.
  generated_for    date not null,
  headline         text not null,
  body             text not null,
  -- [{ signal, detail }] — the concrete data points the insight was built from,
  -- so a claim on the card can always be traced back to a logged number.
  observations     jsonb not null default '[]'::jsonb,
  clinician_prompt text,
  evidence_level   text,
  -- Which backend produced it. 'vps_cli' = Claude Code CLI on the Max plan ($0),
  -- 'gateway' = metered Vercel AI Gateway. Recorded so the cost/quality of a
  -- backend swap is measurable after the fact rather than guessed.
  source           text not null default 'vps_cli' check (source in ('vps_cli','gateway','template')),
  model            text,
  status           text not null default 'active' check (status in ('active','dismissed')),
  dismissed_at     timestamptz,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now()
);

create unique index if not exists ai_insights_user_day_idx on ai_insights(user_id, generated_for);
create index if not exists ai_insights_user_active_idx
  on ai_insights(user_id, generated_for desc) where status = 'active';

alter table ai_insights enable row level security;

-- Read own. Update own, but only to dismiss — the guard-checked text itself is
-- not user-editable, so a dismissed row remains an accurate record of what the
-- app actually said.
create policy ai_insights_select on ai_insights for select using (auth.uid() = user_id);
create policy ai_insights_update on ai_insights for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ai_insights_delete on ai_insights for delete using (auth.uid() = user_id);
-- Deliberately NO insert policy: service-role writes only (same posture as ai_calls).

-- Audited. This table holds statements the product made ABOUT the user's health,
-- which is exactly the class of record that has to be reconstructable later.
drop trigger if exists audit_ai_insights on ai_insights;
create trigger audit_ai_insights after insert or update or delete on ai_insights
  for each row execute function audit_row_change();

-- DOWN (run manually to reverse):
--   drop trigger if exists audit_ai_insights on ai_insights;
--   drop index if exists ai_insights_user_active_idx;
--   drop index if exists ai_insights_user_day_idx;
--   drop table if exists ai_insights;
