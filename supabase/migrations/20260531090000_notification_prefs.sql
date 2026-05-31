-- Notification preferences: add a delivery-channel choice + the two reminder
-- toggles we were missing (weekly summary, body-shot). Existing booleans
-- (notify_dose_reminders, notify_weighin_reminder, notify_safety_alerts) stay.
--
-- channel governs *reminders/summaries* only. Transactional emails (welcome,
-- account-deletion, data-export-ready) and auth emails always send regardless.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel_t') then
    create type notification_channel_t as enum ('in_app', 'email', 'both', 'off');
  end if;
end$$;

alter table user_settings
  add column if not exists notification_channel notification_channel_t not null default 'both',
  add column if not exists notify_weekly_summary boolean not null default true,
  add column if not exists notify_body_shot       boolean not null default true;
