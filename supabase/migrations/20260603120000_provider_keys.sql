-- Configurable AI provider API keys + the Google (Gemini) direct provider.
--
-- Provider keys can now be set from the admin UI and are stored AES-256-GCM
-- encrypted (app-level, master key in AI_SECRETS_KEY). The gateway resolves a
-- key from this table first, then falls back to the env var. Plaintext keys
-- never leave the server; only last4 + presence are surfaced to admins.

-- 1. Allow the google provider kind.
alter table ai_providers drop constraint if exists ai_providers_kind_check;
alter table ai_providers
  add constraint ai_providers_kind_check
  check (kind in ('vercel_gateway','openrouter','voyage','direct','openai','anthropic','google'));

-- 2. Register the Google (Gemini) direct provider.
insert into ai_providers (slug, name, kind, env_key_var, notes)
values ('google', 'Google Gemini (direct)', 'google', 'GOOGLE_API_KEY', 'Native Gemini generateContent API')
on conflict (slug) do nothing;

-- 3. Gemini direct chat/vision models on the google provider (idempotent).
insert into ai_models (provider_id, model_id, display_name, modality, context_window, input_cost_per_1m, output_cost_per_1m, active)
select p.id, v.model_id, v.display_name, v.modality, v.ctx, v.inc, v.outc, true
from ai_providers p
cross join (values
  ('gemini-2.5-flash', 'Gemini 2.5 Flash', 'chat',   1000000, 0.30,  2.50),
  ('gemini-2.5-flash', 'Gemini 2.5 Flash (vision)', 'vision', 1000000, 0.30,  2.50),
  ('gemini-2.5-pro',   'Gemini 2.5 Pro',   'chat',   1000000, 1.25, 10.00)
) as v(model_id, display_name, modality, ctx, inc, outc)
where p.slug = 'google'
on conflict (provider_id, model_id, modality) do nothing;

-- 4. Encrypted provider-key store. Global admin config (NOT user-scoped):
--    RLS is enabled with NO policies, so client roles are denied entirely and
--    only the service-role admin client (server) can read/write. The ciphertext
--    is AES-256-GCM; last4 is for display only.
create table if not exists ai_provider_secrets (
  provider_id  uuid primary key references ai_providers(id) on delete cascade,
  ciphertext   text not null,
  last4        text,
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

alter table ai_provider_secrets enable row level security;
-- Intentionally no policies: deny all client access; service-role only.

-- 5. Audit trail for provider-secret writes (security-relevant: an overwritten
--    key silently redirects all AI traffic). The generic audit_row_change()
--    trigger can't be used here — this table has no user_id column. This bespoke
--    SECURITY DEFINER trigger attributes the audit row to the admin who made the
--    change (updated_by, set by the requireAdmin route) and STRIPS the ciphertext
--    from the before/after payload so the encrypted secret is never duplicated
--    into audit_log. If no actor can be resolved (e.g. the admin account was
--    deleted), the audit insert is skipped rather than breaking the write.
create or replace function audit_ai_provider_secret_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  if (tg_op = 'DELETE') then
    v_user := old.updated_by;
    if v_user is not null then
      insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
        values (tg_table_name, old.provider_id, v_user, 'delete', auth.uid(),
                to_jsonb(old) - 'ciphertext', null);
    end if;
    return old;
  elsif (tg_op = 'UPDATE') then
    v_user := coalesce(new.updated_by, old.updated_by);
    if v_user is not null then
      insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
        values (tg_table_name, new.provider_id, v_user, 'update', auth.uid(),
                to_jsonb(old) - 'ciphertext', to_jsonb(new) - 'ciphertext');
    end if;
    return new;
  else
    v_user := new.updated_by;
    if v_user is not null then
      insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
        values (tg_table_name, new.provider_id, v_user, 'insert', auth.uid(),
                null, to_jsonb(new) - 'ciphertext');
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists audit_ai_provider_secrets on ai_provider_secrets;
create trigger audit_ai_provider_secrets
  after insert or update or delete on ai_provider_secrets
  for each row execute function audit_ai_provider_secret_change();

-- DOWN (manual):
--   drop trigger if exists audit_ai_provider_secrets on ai_provider_secrets;
--   drop function if exists audit_ai_provider_secret_change();
--   drop table if exists ai_provider_secrets;
--   delete from ai_models where provider_id in (select id from ai_providers where slug='google');
--   delete from ai_providers where slug='google';
--   alter table ai_providers drop constraint if exists ai_providers_kind_check;
--   alter table ai_providers add constraint ai_providers_kind_check
--     check (kind in ('vercel_gateway','openrouter','voyage','direct','openai','anthropic'));
