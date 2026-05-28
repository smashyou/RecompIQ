-- Phase 9b: Coach + RAG.
-- peptide_kb stores curated evidence snippets indexed by Voyage embeddings.
-- ai_conversations + ai_messages persist coach chats with citations + tool calls.
-- profiles.educational_consent_at records when the user accepted the "educational, not medical advice" framing.

-- ---------------------------------------------------------------
-- profiles.educational_consent_at
-- ---------------------------------------------------------------
alter table profiles add column if not exists educational_consent_at timestamptz;

-- ---------------------------------------------------------------
-- peptide_kb — curated evidence corpus for RAG.
-- One row = one paragraph-sized snippet tied to a compound + section.
-- Embeddings are 1024-dim (Voyage 3 large default).
-- ---------------------------------------------------------------
create table if not exists peptide_kb (
  id              uuid primary key default gen_random_uuid(),
  compound_slug   text not null references compounds(slug) on delete cascade,
  section         text not null check (section in ('mechanism','dosing','monitoring','contraindications','side_effects','evidence','clinician_discussion','use_pattern','interactions')),
  title           text not null,
  text            text not null,
  source_type     text not null check (source_type in ('fda_label','pubmed','guideline','manufacturer','curated_synthesis','clinical_trial')),
  source_url      text,
  evidence_level  evidence_t not null default 'HUMAN_OBS',
  embedding       vector(1024),
  created_at      timestamptz not null default now()
);

create index if not exists peptide_kb_compound_idx on peptide_kb(compound_slug);
-- ivfflat index on the embedding column — built when we have at least ~64 rows.
-- For MVP we skip the index and use sequential scan; adds it later when corpus grows.
-- create index peptide_kb_embedding_idx on peptide_kb using ivfflat (embedding vector_cosine_ops);

alter table peptide_kb enable row level security;
create policy peptide_kb_select on peptide_kb for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- ai_conversations — one thread per user
-- ---------------------------------------------------------------
create table if not exists ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ai_conversations_user_updated_idx on ai_conversations(user_id, updated_at desc);

create trigger ai_conversations_set_updated_at
  before update on ai_conversations
  for each row execute function set_updated_at();

alter table ai_conversations enable row level security;
create policy ai_conversations_select on ai_conversations for select using (auth.uid() = user_id);
create policy ai_conversations_insert on ai_conversations for insert with check (auth.uid() = user_id);
create policy ai_conversations_update on ai_conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ai_conversations_delete on ai_conversations for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- ai_messages — messages within a conversation
-- ---------------------------------------------------------------
create table if not exists ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system','tool')),
  content         text not null,
  -- For assistant rows: which peptide_kb rows fed the response.
  citations       jsonb not null default '[]'::jsonb,
  -- For assistant rows: any tool calls + their results (logFood etc. — Phase 9c).
  tool_calls      jsonb not null default '[]'::jsonb,
  -- For observability: which model answered + token counts.
  model_string    text,
  provider_slug   text,
  input_tokens    int,
  output_tokens   int,
  latency_ms      int,
  created_at      timestamptz not null default now()
);
create index if not exists ai_messages_conv_created_idx on ai_messages(conversation_id, created_at);

alter table ai_messages enable row level security;
create policy ai_messages_select on ai_messages for select using (auth.uid() = user_id);
create policy ai_messages_insert on ai_messages for insert with check (auth.uid() = user_id);
create policy ai_messages_update on ai_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ai_messages_delete on ai_messages for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- search_peptide_kb — RPC for cosine similarity search when embeddings exist.
-- Falls back to text ILIKE in lib/rag.ts when embedding param is null.
-- ---------------------------------------------------------------
create or replace function search_peptide_kb(
  query_embedding vector(1024),
  match_count int default 6,
  filter_slugs text[] default null
)
returns table (
  id uuid,
  compound_slug text,
  section text,
  title text,
  text text,
  source_type text,
  source_url text,
  evidence_level evidence_t,
  similarity float
)
language sql stable
as $$
  select
    kb.id, kb.compound_slug, kb.section, kb.title, kb.text,
    kb.source_type, kb.source_url, kb.evidence_level,
    1 - (kb.embedding <=> query_embedding) as similarity
  from peptide_kb kb
  where kb.embedding is not null
    and (filter_slugs is null or kb.compound_slug = any(filter_slugs))
  order by kb.embedding <=> query_embedding
  limit match_count
$$;
