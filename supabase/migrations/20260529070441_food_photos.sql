-- Phase 11: photo food logging — stores uploaded food images + AI parse results.
-- Photos live in Vercel Blob (public URLs with unguessable hash); DB row gates
-- access via RLS. food_logs.photo_asset_id links each created log back to its
-- source photo for traceability and a "view the original" UX later.

create table if not exists food_photo_assets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  blob_url          text not null,
  blob_pathname     text not null,
  mime_type         text not null,
  size_bytes        int  not null check (size_bytes > 0 and size_bytes <= 15728640),
  vision_provider   text,
  vision_model      text,
  parsed_at         timestamptz,
  parsed_items      jsonb,
  parse_error       text,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  is_demo           boolean not null default false
);

create index if not exists food_photo_assets_user_created_idx
  on food_photo_assets(user_id, created_at desc);

alter table food_photo_assets enable row level security;

create policy food_photo_assets_select on food_photo_assets
  for select using (auth.uid() = user_id);
create policy food_photo_assets_insert on food_photo_assets
  for insert with check (auth.uid() = user_id);
create policy food_photo_assets_update on food_photo_assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy food_photo_assets_delete on food_photo_assets
  for delete using (auth.uid() = user_id);

-- Link confirmed food_logs back to the source photo.
-- on delete set null keeps the food_log intact if the user later removes the photo.
alter table food_logs
  add column if not exists photo_asset_id uuid references food_photo_assets(id) on delete set null;

create index if not exists food_logs_photo_asset_idx
  on food_logs(photo_asset_id) where photo_asset_id is not null;
