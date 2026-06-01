-- Audit log for safety-critical tables (schema-guardian carryover).
-- A generic trigger records before/after row state on insert/update/delete.
-- RLS: a user reads only their own audit rows; ONLY the SECURITY DEFINER trigger
-- writes (no client write policy). Row data at rest under RLS — not stdout.

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      uuid,
  user_id     uuid not null references auth.users(id) on delete cascade,
  op          text not null check (op in ('insert','update','delete')),
  actor       uuid,                 -- auth.uid() at write time; NULL when invoked by service role / background job
  before      jsonb,
  after       jsonb,
  changed_at  timestamptz not null default now()
);
create index if not exists audit_log_user_idx on audit_log(user_id, changed_at desc);
create index if not exists audit_log_table_row_idx on audit_log(table_name, row_id);
create index if not exists audit_log_op_idx on audit_log(table_name, op, changed_at desc);

alter table audit_log enable row level security;
create policy audit_log_select on audit_log for select using (auth.uid() = user_id);
-- No insert/update/delete policies: clients can never write. Inserts happen only
-- via the SECURITY DEFINER trigger below (which bypasses RLS). Client deletes are
-- denied by the absent policy; the only DELETEs that occur are the auth.users
-- on-delete cascade (account deletion — required by the privacy posture).

-- Immutability: audit rows can never be UPDATEd (content is tamper-evident). We
-- deliberately do NOT block DELETE at the trigger layer, because account deletion
-- must cascade-remove a user's audit trail (CLAUDE.md "DELETE /api/me cascades");
-- direct client deletes are already prevented by the absent RLS delete policy.
create or replace function audit_log_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_log rows are immutable (attempted %)', tg_op;
end;
$$;
drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update before update on audit_log
  for each row execute function audit_log_immutable();

-- Generic audit trigger. Reads user_id from the row (all target tables have it).
create or replace function audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_row_id uuid;
begin
  if (tg_op = 'DELETE') then
    v_user := old.user_id;
    v_row_id := old.id;
    insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
      values (tg_table_name, v_row_id, v_user, 'delete', auth.uid(), to_jsonb(old), null);
    return old;
  elsif (tg_op = 'UPDATE') then
    v_user := new.user_id;
    v_row_id := new.id;
    insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
      values (tg_table_name, v_row_id, v_user, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_user := new.user_id;
    v_row_id := new.id;
    insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
      values (tg_table_name, v_row_id, v_user, 'insert', auth.uid(), null, to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists audit_lab_results on lab_results;
create trigger audit_lab_results after insert or update or delete on lab_results
  for each row execute function audit_row_change();
drop trigger if exists audit_peptide_doses on peptide_doses;
create trigger audit_peptide_doses after insert or update or delete on peptide_doses
  for each row execute function audit_row_change();
drop trigger if exists audit_vitals on vitals;
create trigger audit_vitals after insert or update or delete on vitals
  for each row execute function audit_row_change();
drop trigger if exists audit_weights on weights;
create trigger audit_weights after insert or update or delete on weights
  for each row execute function audit_row_change();

-- DOWN (run manually to reverse):
--   drop trigger if exists audit_lab_results on lab_results;
--   drop trigger if exists audit_peptide_doses on peptide_doses;
--   drop trigger if exists audit_vitals on vitals;
--   drop trigger if exists audit_weights on weights;
--   drop trigger if exists audit_log_no_update on audit_log;
--   drop function if exists audit_row_change();
--   drop function if exists audit_log_immutable();
--   drop table if exists audit_log;
