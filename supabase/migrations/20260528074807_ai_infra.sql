-- Phase 9a: AI infrastructure tables + pgvector extension + admin role.
-- Lays the foundation for: coach (9b), photo food (11), photo body shots (9c),
-- photo lab uploads (12), peptide stacker (10).

-- ---------------------------------------------------------------
-- pgvector extension (used by peptide_kb in Phase 9b)
-- ---------------------------------------------------------------
create extension if not exists "vector";

-- ---------------------------------------------------------------
-- profiles.is_admin
-- ---------------------------------------------------------------
alter table profiles add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------
-- ai_providers: transport-level providers
-- ---------------------------------------------------------------
create table if not exists ai_providers (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  kind          text not null check (kind in ('vercel_gateway','openrouter','voyage','direct')),
  base_url      text,                     -- override for direct providers
  env_key_var   text not null,            -- name of the env var holding the API key (e.g. AI_GATEWAY_API_KEY)
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table ai_providers enable row level security;
-- All authenticated users can read providers (used by clients to display names).
create policy ai_providers_select on ai_providers for select using (auth.role() = 'authenticated');
-- Only admin can write (via service role; the admin UI uses service role through API routes).

insert into ai_providers (slug, name, kind, env_key_var, notes) values
  ('vercel_gateway', 'Vercel AI Gateway',   'vercel_gateway', 'AI_GATEWAY_API_KEY',    'Routes OpenAI/Anthropic/Google with unified billing + observability.'),
  ('openrouter',     'OpenRouter',          'openrouter',     'OPENROUTER_API_KEY',    'Aggregates ~300 models — Qwen, Kimi, DeepSeek, Gemma, Llama, etc.'),
  ('voyage',         'Voyage AI',           'voyage',         'VOYAGE_API_KEY',        'Embedding-only provider. voyage-3-large = current best.')
on conflict (slug) do update set
  name = excluded.name, kind = excluded.kind, env_key_var = excluded.env_key_var, notes = excluded.notes;

-- ---------------------------------------------------------------
-- ai_models: specific models within each provider
-- ---------------------------------------------------------------
create table if not exists ai_models (
  id              uuid primary key default gen_random_uuid(),
  provider_id     uuid not null references ai_providers(id) on delete cascade,
  model_id        text not null,                                  -- e.g. "anthropic/claude-sonnet-4-6"
  display_name    text not null,
  modality        text not null check (modality in ('chat','vision','embedding')),
  context_window  int,                                            -- tokens
  input_cost_per_1m   numeric(10,4),                              -- $ per 1M input tokens
  output_cost_per_1m  numeric(10,4),                              -- $ per 1M output tokens
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (provider_id, model_id, modality)
);
create index if not exists ai_models_modality_idx on ai_models(modality, active);

alter table ai_models enable row level security;
create policy ai_models_select on ai_models for select using (auth.role() = 'authenticated');

-- Seed catalog. Costs are approximate USD per 1M tokens as of mid-2026.
-- Use display_name in UI; model_id is what we pass to the provider.
with prov as (select id, slug from ai_providers)
insert into ai_models (provider_id, model_id, display_name, modality, context_window, input_cost_per_1m, output_cost_per_1m, notes)
select p.id, m.model_id, m.display_name, m.modality, m.context_window, m.input_cost, m.output_cost, m.notes
from (values
  -- Vercel AI Gateway routes (chat)
  ('vercel_gateway', 'anthropic/claude-sonnet-4-6',  'Claude Sonnet 4.6',        'chat',      200000,  3.00, 15.00,  'Default coach. Best reasoning + instruction-following.'),
  ('vercel_gateway', 'anthropic/claude-haiku-4-5',   'Claude Haiku 4.5',         'chat',      200000,  1.00,  5.00,  'Cheap fast tier — daily insight cron.'),
  ('vercel_gateway', 'anthropic/claude-opus-4-7',    'Claude Opus 4.7',          'chat',     1000000, 15.00, 75.00,  'Most capable; reserved for stacker reasoning.'),
  ('vercel_gateway', 'openai/gpt-5',                 'GPT-5',                    'chat',      400000,  2.50, 10.00,  'Strong general-purpose fallback.'),
  ('vercel_gateway', 'openai/gpt-4o',                'GPT-4o',                   'chat',      128000,  2.50, 10.00,  'Multimodal text + vision.'),
  ('vercel_gateway', 'google/gemini-2.5-pro',        'Gemini 2.5 Pro',           'chat',     2000000,  1.25,  5.00,  'Massive context window, strong vision.'),
  ('vercel_gateway', 'google/gemini-2.5-flash',      'Gemini 2.5 Flash',         'chat',     1000000,  0.30,  2.50,  'Cheap fast vision.'),
  -- Vercel AI Gateway routes (vision-capable subset)
  ('vercel_gateway', 'anthropic/claude-sonnet-4-6',  'Claude Sonnet 4.6 (vision)', 'vision', 200000,  3.00, 15.00,  'Same model, used for image input.'),
  ('vercel_gateway', 'openai/gpt-4o',                'GPT-4o (vision)',          'vision',    128000,  2.50, 10.00,  ''),
  ('vercel_gateway', 'google/gemini-2.5-flash',      'Gemini 2.5 Flash (vision)', 'vision',  1000000,  0.30,  2.50,  'Cheapest vision option.'),
  -- OpenRouter — Chinese + open models
  ('openrouter',     'qwen/qwen3-coder-480b-a35b',   'Qwen3 Coder 480B',         'chat',      256000,  0.40,  1.60,  'Alibaba flagship coder. Excellent value for chat.'),
  ('openrouter',     'qwen/qwen3-235b-a22b-thinking', 'Qwen3 235B Thinking',     'chat',      262000,  0.30,  1.20,  'Reasoning-tuned cheap fallback.'),
  ('openrouter',     'moonshotai/kimi-k2-instruct',  'Kimi K2 Instruct',         'chat',      131000,  0.40,  2.00,  'Moonshot K2; strong tool-calling.'),
  ('openrouter',     'deepseek/deepseek-v3.2',       'DeepSeek V3.2',            'chat',      131000,  0.27,  1.10,  'Best $/token in class. Tool-call capable.'),
  ('openrouter',     'google/gemma-3-27b-it',        'Gemma 3 27B',              'chat',      128000,  0.10,  0.20,  'Google open-source; cheap.'),
  ('openrouter',     'zhipu/glm-4.6',                'GLM-4.6',                  'chat',      200000,  0.40,  2.00,  'Zhipu AI, competitive on Chinese-language tasks.'),
  -- Voyage (embeddings)
  ('voyage',         'voyage-3-large',               'Voyage 3 Large',           'embedding',   32000, 0.18,  null,   '1024 dims. Best general-purpose embeddings (Voyage benchmark).'),
  ('voyage',         'voyage-3.5-lite',              'Voyage 3.5 Lite',          'embedding',   32000, 0.02,  null,   '512/1024 dims. Cheap fast tier.')
) as m(provider_slug, model_id, display_name, modality, context_window, input_cost, output_cost, notes)
join prov p on p.slug = m.provider_slug
on conflict (provider_id, model_id, modality) do update set
  display_name = excluded.display_name, context_window = excluded.context_window,
  input_cost_per_1m = excluded.input_cost_per_1m, output_cost_per_1m = excluded.output_cost_per_1m, notes = excluded.notes;

-- ---------------------------------------------------------------
-- ai_feature_config: per-feature primary + fallback chain
-- ---------------------------------------------------------------
create table if not exists ai_feature_config (
  feature         text primary key check (feature in ('coach','vision','embeddings','insights','stacker','transcribe')),
  primary_model_id  uuid not null references ai_models(id),
  fallback_ids      uuid[] not null default '{}',  -- ordered fallback chain
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id)
);

alter table ai_feature_config enable row level security;
-- All authenticated users can read (so the gateway can pull config at request time).
create policy ai_feature_config_select on ai_feature_config for select using (auth.role() = 'authenticated');
-- Writes happen via service role through admin API routes.

-- Default per-feature wiring. Idempotent.
-- coach = claude-sonnet-4-6, fallback gpt-5, qwen3
do $$
declare
  v_coach uuid := (select id from ai_models where model_id = 'anthropic/claude-sonnet-4-6' and modality = 'chat');
  v_coach_fb1 uuid := (select id from ai_models where model_id = 'openai/gpt-5' and modality = 'chat');
  v_coach_fb2 uuid := (select id from ai_models where model_id = 'qwen/qwen3-coder-480b-a35b' and modality = 'chat');

  v_vision uuid := (select id from ai_models where model_id = 'anthropic/claude-sonnet-4-6' and modality = 'vision');
  v_vision_fb1 uuid := (select id from ai_models where model_id = 'openai/gpt-4o' and modality = 'vision');
  v_vision_fb2 uuid := (select id from ai_models where model_id = 'google/gemini-2.5-flash' and modality = 'vision');

  v_embed uuid := (select id from ai_models where model_id = 'voyage-3-large' and modality = 'embedding');
  v_embed_fb1 uuid := (select id from ai_models where model_id = 'voyage-3.5-lite' and modality = 'embedding');

  v_insights uuid := (select id from ai_models where model_id = 'anthropic/claude-haiku-4-5' and modality = 'chat');
  v_insights_fb1 uuid := (select id from ai_models where model_id = 'google/gemini-2.5-flash' and modality = 'chat');

  v_stacker uuid := (select id from ai_models where model_id = 'anthropic/claude-opus-4-7' and modality = 'chat');
  v_stacker_fb1 uuid := (select id from ai_models where model_id = 'anthropic/claude-sonnet-4-6' and modality = 'chat');
begin
  insert into ai_feature_config (feature, primary_model_id, fallback_ids) values
    ('coach',    v_coach,    array_remove(array[v_coach_fb1, v_coach_fb2], null)),
    ('vision',   v_vision,   array_remove(array[v_vision_fb1, v_vision_fb2], null)),
    ('embeddings', v_embed,  array_remove(array[v_embed_fb1], null)),
    ('insights', v_insights, array_remove(array[v_insights_fb1], null)),
    ('stacker',  v_stacker,  array_remove(array[v_stacker_fb1], null))
  on conflict (feature) do nothing;  -- don't clobber existing admin choices on re-migration
end$$;

-- ---------------------------------------------------------------
-- ai_calls: per-call usage log for cost tracking + debugging
-- ---------------------------------------------------------------
create table if not exists ai_calls (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete set null,
  feature            text not null,
  model_id           uuid references ai_models(id) on delete set null,
  provider_slug      text not null,
  model_string       text not null,           -- raw model id string (in case the model row is later deleted)
  input_tokens       int,
  output_tokens      int,
  total_cost_usd     numeric(10,6),           -- computed at log time from model pricing
  latency_ms         int,
  status             text not null check (status in ('ok','error','fallback')),
  error_message      text,
  request_excerpt    text,                    -- first ~200 chars of the user-facing input, PII-redacted
  created_at         timestamptz not null default now()
);
create index if not exists ai_calls_user_created_idx on ai_calls(user_id, created_at desc);
create index if not exists ai_calls_feature_created_idx on ai_calls(feature, created_at desc);

alter table ai_calls enable row level security;
-- Users can see their own call history; admins see all.
create policy ai_calls_select_self on ai_calls for select using (
  auth.uid() = user_id or
  exists (select 1 from profiles p where p.user_id = auth.uid() and p.is_admin = true)
);
-- Inserts come via service role only.
