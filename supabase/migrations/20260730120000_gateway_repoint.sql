-- Repoint the text AI features (coach / stacker / insights) from Anthropic-direct
-- to the Vercel AI Gateway.
--
-- WHY: the operator's Anthropic account has $0 credit. The key is valid, so every
-- coach / stacker / insights call spends a full round-trip getting
-- "Your credit balance is too low" before the fallback chain reaches OpenAI.
-- The gateway reaches the same Sonnet model and bills through Vercel.
--
-- This migration also repairs two things that made the gateway rows unusable, and
-- which together explain why 20260531190000_direct_providers.sql concluded the
-- gateway was "failing/unreachable":
--
--   1. Gateway model slugs were stored in the DIRECT-API form (hyphenated:
--      `anthropic/claude-sonnet-4-6`). The gateway's own catalog uses DOTTED
--      version slugs (`anthropic/claude-sonnet-4.6`); the hyphenated ids 400.
--   2. (code, not SQL) the adapter posted to `https://gateway.ai.vercel.com/v1`,
--      a host that no longer completes a TLS handshake. Fixed in the same commit
--      in packages/agent/src/providers/index.ts — the live host is
--      `https://ai-gateway.vercel.sh/v1`.
--
-- Vision is deliberately UNTOUCHED: it is already gpt-4o-direct primary and works.

-- 1. Correct the gateway model slugs to the dotted upstream form.
--    Verified against https://ai-gateway.vercel.sh/v1/models on 2026-07-30.
--    The unique key is (provider_id, model_id, modality), so these renames cannot
--    collide with an existing row.
update ai_models m set model_id = v.new_id
from (values
  ('anthropic/claude-sonnet-4-6', 'anthropic/claude-sonnet-4.6'),
  ('anthropic/claude-haiku-4-5',  'anthropic/claude-haiku-4.5'),
  ('anthropic/claude-opus-4-7',   'anthropic/claude-opus-4.7')
) as v(old_id, new_id)
where m.model_id = v.old_id
  and m.provider_id = (select id from ai_providers where slug = 'vercel_gateway');

-- 2. Repoint coach / stacker / insights → gateway Sonnet 4.6, keeping
--    OpenAI-direct gpt-4o (the account that actually has credit) as the fallback.
create or replace function _mid(p_slug text, p_model text, p_modality text) returns uuid as $$
  select mm.id from ai_models mm join ai_providers pp on mm.provider_id = pp.id
  where pp.slug = p_slug and mm.model_id = p_model and mm.modality = p_modality limit 1;
$$ language sql stable;

update ai_feature_config set
  primary_model_id = _mid('vercel_gateway','anthropic/claude-sonnet-4.6','chat'),
  fallback_ids = array[ _mid('openai','gpt-4o','chat') ]::uuid[],
  updated_at = now()
where feature in ('coach','stacker','insights');

-- Fail loudly rather than silently leaving a feature pointed at a NULL model.
do $$
begin
  if exists (select 1 from ai_feature_config where primary_model_id is null) then
    raise exception 'ai_feature_config has a null primary_model_id — repoint failed';
  end if;
end $$;

drop function _mid(text, text, text);

-- DOWN (run manually to reverse):
--   update ai_feature_config set
--     primary_model_id = (select mm.id from ai_models mm join ai_providers pp on mm.provider_id = pp.id
--                         where pp.slug='anthropic' and mm.model_id='claude-sonnet-4-6' and mm.modality='chat'),
--     fallback_ids = array[(select mm.id from ai_models mm join ai_providers pp on mm.provider_id = pp.id
--                           where pp.slug='openai' and mm.model_id='gpt-4o' and mm.modality='chat')]::uuid[]
--   where feature in ('coach','stacker');
--   -- insights was claude-haiku-4-5 (anthropic direct) before this migration.
