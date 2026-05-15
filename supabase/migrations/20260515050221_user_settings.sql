-- user_settings: per-user preferences (vision provider, unit overrides, theme, notifications).
-- One row per user. Auto-created by handle_new_user trigger alongside profile.

create table if not exists user_settings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  vision_provider          vision_provider_t not null default 'anthropic',
  theme                    text not null default 'dark' check (theme in ('light','dark','system')),
  notify_dose_reminders    boolean not null default true,
  notify_weighin_reminder  boolean not null default true,
  notify_safety_alerts     boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists user_settings_user_idx on user_settings(user_id);

create trigger user_settings_set_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

alter table user_settings enable row level security;

create policy user_settings_select on user_settings for select using (auth.uid() = user_id);
create policy user_settings_insert on user_settings for insert with check (auth.uid() = user_id);
create policy user_settings_update on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_settings_delete on user_settings for delete using (auth.uid() = user_id);

-- Replace handle_new_user to also create the user_settings row alongside the profile.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Backfill user_settings for any existing auth users (idempotent).
insert into public.user_settings (user_id)
select u.id from auth.users u
left join public.user_settings s on s.user_id = u.id
where s.user_id is null;
