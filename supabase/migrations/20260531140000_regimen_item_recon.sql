-- Phase 2 of the goal-driven Regimen redesign (docs/REGIMEN_GOALS_PRD.md §5.3/§5.4).
--
-- Links a regimen item to its active reconstitution mix so "draw X units"
-- follows the compound everywhere (regimen page, dose-log), and a DATED mix
-- history accrues in reconstitution_records (re-mixing creates a new record and
-- repoints the item). This turns the formerly dead-end "Save this mix" into a
-- connected step of adding/editing a peptide.
--
-- Purely additive: one nullable FK column with on-delete set null (deleting a
-- mix record just unlinks the item; it does not delete the item).

alter table regimen_items
  add column if not exists reconstitution_record_id uuid
    references reconstitution_records(id) on delete set null;

create index if not exists regimen_items_recon_idx
  on regimen_items(reconstitution_record_id);

-- Enforce that the linked reconstitution_record belongs to the SAME user as the
-- item. RLS blocks reading another user's records, but does not stop an item
-- (owned by the writer) from pointing at someone else's record id. This trigger
-- closes that cross-user gap at the DB layer. Surfaced as an FK violation so the
-- existing app error handling catches it unchanged.
create or replace function check_recon_record_owner()
returns trigger language plpgsql as $$
begin
  if new.reconstitution_record_id is not null then
    if not exists (
      select 1 from reconstitution_records
      where id = new.reconstitution_record_id
        and user_id = new.user_id
    ) then
      raise exception
        'reconstitution_record % does not belong to user %',
        new.reconstitution_record_id, new.user_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists regimen_items_recon_owner_check on regimen_items;
create trigger regimen_items_recon_owner_check
  before insert or update of reconstitution_record_id, user_id
  on regimen_items
  for each row execute function check_recon_record_owner();

-- DOWN (run manually to reverse):
--   drop trigger if exists regimen_items_recon_owner_check on regimen_items;
--   drop function if exists check_recon_record_owner();
--   alter table regimen_items drop column if exists reconstitution_record_id;
