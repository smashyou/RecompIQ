-- Phase 9c: periodic body-shot capture for visual progress tracking.
-- One row per capture session (4 angles together). Photos live in Vercel Blob;
-- the row stores the public URLs. Each Blob URL contains an unguessable random
-- hash, and RLS gates the DB rows so only the owner can list their photos.

create table if not exists body_photos (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  captured_at           timestamptz not null default now(),
  front_url             text,
  back_url              text,
  left_url              text,
  right_url             text,
  weight_at_capture_lb  numeric(5,2) check (weight_at_capture_lb is null or (weight_at_capture_lb between 50 and 800)),
  notes                 text,
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists body_photos_user_captured_idx on body_photos(user_id, captured_at desc);

alter table body_photos enable row level security;
create policy body_photos_select on body_photos for select using (auth.uid() = user_id);
create policy body_photos_insert on body_photos for insert with check (auth.uid() = user_id);
create policy body_photos_update on body_photos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy body_photos_delete on body_photos for delete using (auth.uid() = user_id);

-- Schedule preference. 0 = reminders off.
alter table user_settings
  add column if not exists body_photo_frequency_days int not null default 7 check (body_photo_frequency_days between 0 and 365);
