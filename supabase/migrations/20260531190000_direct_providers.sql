-- Direct provider support (fixes the prod 502: every AI call previously routed
-- ONLY through the Vercel AI Gateway, which was failing). Adds first-class
-- OpenAI + Anthropic providers that call the native APIs with the operator's own
-- OPENAI_API_KEY / ANTHROPIC_API_KEY, and repoints the feature configs to them
-- (primary), keeping the Vercel gateway as a last-resort fallback.
--
-- Admin's ai_feature_config remains the single source of truth for which model
-- answers each feature; users no longer pick.

-- 1. Widen the provider-kind check to allow the two direct kinds.
alter table ai_providers drop constraint if exists ai_providers_kind_check;
alter table ai_providers add constraint ai_providers_kind_check
  check (kind in ('vercel_gateway','openrouter','voyage','direct','openai','anthropic'));

-- 2. Register the two direct providers.
insert into ai_providers (slug, name, kind, env_key_var, notes) values
  ('openai',    'OpenAI (direct)',    'openai',    'OPENAI_API_KEY',    'Native OpenAI API. Used with the operator''s own key.'),
  ('anthropic', 'Anthropic (direct)', 'anthropic', 'ANTHROPIC_API_KEY', 'Native Anthropic Messages API. Used with the operator''s own key.')
on conflict (slug) do update set
  name = excluded.name, kind = excluded.kind, env_key_var = excluded.env_key_var, notes = excluded.notes;

-- 3. Catalog the direct models (bare model ids — no provider/ prefix).
with prov as (select id, slug from ai_providers)
insert into ai_models (provider_id, model_id, display_name, modality, context_window, input_cost_per_1m, output_cost_per_1m, notes)
select p.id, m.model_id, m.display_name, m.modality, m.context_window, m.input_cost, m.output_cost, m.notes
from (values
  ('anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6',          'chat',   200000, 3.00, 15.00, 'Direct Anthropic. Default coach/stacker.'),
  ('anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6 (vision)', 'vision', 200000, 3.00, 15.00, 'Direct Anthropic vision (image input).'),
  ('anthropic', 'claude-haiku-4-5',  'Claude Haiku 4.5',           'chat',   200000, 1.00,  5.00, 'Direct Anthropic cheap/fast tier.'),
  ('openai',    'gpt-4o',            'GPT-4o',                     'chat',   128000, 2.50, 10.00, 'Direct OpenAI multimodal.'),
  ('openai',    'gpt-4o',            'GPT-4o (vision)',            'vision', 128000, 2.50, 10.00, 'Direct OpenAI vision — default vision primary.')
) as m(provider_slug, model_id, display_name, modality, context_window, input_cost, output_cost, notes)
join prov p on p.slug = m.provider_slug
on conflict (provider_id, model_id, modality) do update set
  display_name = excluded.display_name, context_window = excluded.context_window,
  input_cost_per_1m = excluded.input_cost_per_1m, output_cost_per_1m = excluded.output_cost_per_1m, notes = excluded.notes;

-- 4. Repoint feature configs → direct providers (primary), gateway as fallback.
create or replace function _mid(p_slug text, p_model text, p_modality text) returns uuid as $$
  select mm.id from ai_models mm join ai_providers pp on mm.provider_id = pp.id
  where pp.slug = p_slug and mm.model_id = p_model and mm.modality = p_modality limit 1;
$$ language sql stable;

update ai_feature_config set
  primary_model_id = _mid('openai','gpt-4o','vision'),
  fallback_ids = array[
    _mid('anthropic','claude-sonnet-4-6','vision'),
    _mid('vercel_gateway','google/gemini-2.5-flash','vision')
  ]::uuid[],
  updated_at = now()
where feature = 'vision';

update ai_feature_config set
  primary_model_id = _mid('anthropic','claude-sonnet-4-6','chat'),
  fallback_ids = array[ _mid('openai','gpt-4o','chat') ]::uuid[],
  updated_at = now()
where feature = 'coach';

update ai_feature_config set
  primary_model_id = _mid('anthropic','claude-sonnet-4-6','chat'),
  fallback_ids = array[ _mid('openai','gpt-4o','chat') ]::uuid[],
  updated_at = now()
where feature = 'stacker';

update ai_feature_config set
  primary_model_id = _mid('anthropic','claude-haiku-4-5','chat'),
  fallback_ids = array[ _mid('openai','gpt-4o','chat') ]::uuid[],
  updated_at = now()
where feature = 'insights';

drop function _mid(text, text, text);

-- DOWN (run manually to reverse):
--   -- repoint configs back to vercel_gateway models, then:
--   delete from ai_models where provider_id in (select id from ai_providers where slug in ('openai','anthropic'));
--   delete from ai_providers where slug in ('openai','anthropic');
--   alter table ai_providers drop constraint if exists ai_providers_kind_check;
--   alter table ai_providers add constraint ai_providers_kind_check
--     check (kind in ('vercel_gateway','openrouter','voyage','direct'));
