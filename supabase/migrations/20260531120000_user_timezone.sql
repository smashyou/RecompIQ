-- Store each user's IANA timezone so the reminder cron can evaluate eligibility
-- (their Monday for weekly summaries, day-counts for photo reminders) in local
-- time rather than UTC. Captured client-side from Intl on settings save.
-- Note: the cron itself still fires once daily (Hobby limit); timezone only
-- shifts WHO is eligible on a given run, not the send instant. True per-user
-- send timing needs an hourly cron (Pro).
alter table user_settings
  add column if not exists timezone text not null default 'UTC';
