-- Peptide tracking: compounds catalog (public, seeded), stacks, stack items,
-- doses, and reconstitution records. RLS user-scoped on everything user-touchable.
-- Compounds catalog is read-only to all authenticated users.

-- ---------------------------------------------------------------
-- compounds — seeded reference data
-- ---------------------------------------------------------------
create table if not exists compounds (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique,
  name                        text not null,
  aliases                     text[] not null default '{}',
  category                    text not null check (category in ('incretin','growth_factor','tissue_repair','metabolic','longevity','other')),
  evidence_level              evidence_t not null,
  fda_approved                boolean not null default false,
  short_description           text not null,
  mechanism                   text,
  typical_route               route_t,
  monitoring_notes            text[] not null default '{}',
  absolute_contraindications  text[] not null default '{}',
  relative_contraindications  text[] not null default '{}',
  common_side_effects         text[] not null default '{}',
  serious_adverse_events      text[] not null default '{}',
  citations                   jsonb not null default '[]'::jsonb,
  created_at                  timestamptz not null default now()
);
create index if not exists compounds_category_idx on compounds(category);

alter table compounds enable row level security;
-- Read-only for authenticated users; service role can write via seeds.
create policy compounds_select on compounds for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------
-- peptide_stacks — a user's protocol (active or historical)
-- ---------------------------------------------------------------
create table if not exists peptide_stacks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  phase       goal_phase_t,
  started_on  date,
  ended_on    date,
  notes       text,
  is_active   boolean not null default true,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists peptide_stacks_user_idx on peptide_stacks(user_id, is_active);

create trigger peptide_stacks_set_updated_at
  before update on peptide_stacks
  for each row execute function set_updated_at();

alter table peptide_stacks enable row level security;
create policy peptide_stacks_select on peptide_stacks for select using (auth.uid() = user_id);
create policy peptide_stacks_insert on peptide_stacks for insert with check (auth.uid() = user_id);
create policy peptide_stacks_update on peptide_stacks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy peptide_stacks_delete on peptide_stacks for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- peptide_stack_items — compounds + dose schedule within a stack.
-- DOSE VALUES are user/clinician supplied — the app does NOT prescribe.
-- ---------------------------------------------------------------
create table if not exists peptide_stack_items (
  id           uuid primary key default gen_random_uuid(),
  stack_id     uuid not null references peptide_stacks(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  compound_id  uuid not null references compounds(id),
  dose_value   numeric(8,3) not null check (dose_value > 0),
  dose_unit    text not null check (dose_unit in ('mg','mcg','iu','ml','units')),
  route        route_t not null,
  frequency    text not null, -- "daily", "EOD", "Mon/Wed/Fri", "weekly", etc.
  notes        text,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists peptide_stack_items_stack_idx on peptide_stack_items(stack_id);

alter table peptide_stack_items enable row level security;
create policy peptide_stack_items_select on peptide_stack_items for select using (auth.uid() = user_id);
create policy peptide_stack_items_insert on peptide_stack_items for insert with check (auth.uid() = user_id);
create policy peptide_stack_items_update on peptide_stack_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy peptide_stack_items_delete on peptide_stack_items for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- peptide_doses — each individual dose taken (or skipped)
-- ---------------------------------------------------------------
create table if not exists peptide_doses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  stack_item_id   uuid references peptide_stack_items(id) on delete set null,
  compound_id     uuid not null references compounds(id),
  taken_at        timestamptz not null default now(),
  dose_value      numeric(8,3) not null check (dose_value > 0),
  dose_unit       text not null check (dose_unit in ('mg','mcg','iu','ml','units')),
  route           route_t not null,
  injection_site  text,
  adherence       adherence_t not null default 'taken',
  side_effects    text[] not null default '{}',
  notes           text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists peptide_doses_user_taken_at_idx on peptide_doses(user_id, taken_at desc);
create index if not exists peptide_doses_stack_item_idx on peptide_doses(stack_item_id);

alter table peptide_doses enable row level security;
create policy peptide_doses_select on peptide_doses for select using (auth.uid() = user_id);
create policy peptide_doses_insert on peptide_doses for insert with check (auth.uid() = user_id);
create policy peptide_doses_update on peptide_doses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy peptide_doses_delete on peptide_doses for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- reconstitution_records — vial mix history for traceability
-- ---------------------------------------------------------------
create table if not exists reconstitution_records (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  compound_id              uuid references compounds(id),
  vial_mg                  numeric(8,3) not null check (vial_mg > 0),
  bac_water_ml             numeric(6,2) not null check (bac_water_ml > 0),
  concentration_mg_per_ml  numeric(8,4) not null,
  reconstituted_on         date not null default current_date,
  notes                    text,
  is_demo                  boolean not null default false,
  created_at               timestamptz not null default now()
);
create index if not exists reconstitution_records_user_idx on reconstitution_records(user_id, reconstituted_on desc);

alter table reconstitution_records enable row level security;
create policy reconstitution_records_select on reconstitution_records for select using (auth.uid() = user_id);
create policy reconstitution_records_insert on reconstitution_records for insert with check (auth.uid() = user_id);
create policy reconstitution_records_update on reconstitution_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reconstitution_records_delete on reconstitution_records for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Compound seed (8 compounds for MVP). Idempotent via on conflict (slug).
-- ALL DOSE INFO IS DELIBERATELY OMITTED. The app does not prescribe.
-- ---------------------------------------------------------------
insert into compounds (
  slug, name, aliases, category, evidence_level, fda_approved,
  short_description, mechanism, typical_route,
  monitoring_notes, absolute_contraindications, relative_contraindications,
  common_side_effects, serious_adverse_events, citations
) values
(
  'retatrutide', 'Retatrutide', ARRAY['LY3437943'], 'incretin', 'HUMAN_RCT', false,
  'Triple-agonist (GLP-1/GIP/glucagon) investigational for obesity and T2D.',
  'Activates GLP-1, GIP, and glucagon receptors. GLP-1+GIP suppress appetite and slow gastric emptying; glucagon engagement adds energy-expenditure effect, hypothesized to drive greater fat loss than GLP-1-only agonists.',
  'sc',
  ARRAY['A1c, fasting glucose every 4-8 wk', 'Lipase / amylase if abdominal pain', 'Lipid panel quarterly', 'BP and HR'],
  ARRAY['Personal or family history of medullary thyroid carcinoma', 'MEN 2 syndrome', 'Pregnancy', 'Active pancreatitis'],
  ARRAY['Severe gastroparesis', 'Prior pancreatitis', 'Active gallbladder disease', 'Severe diabetic retinopathy'],
  ARRAY['Nausea', 'Diarrhea', 'Constipation', 'Reduced appetite', 'Injection-site reaction'],
  ARRAY['Pancreatitis (rare)', 'Gallbladder events', 'Severe GI distress at high titration'],
  '[{"title":"Triple-hormone-receptor agonist retatrutide for obesity","journal":"NEJM","year":2023,"url":"https://www.nejm.org/doi/full/10.1056/NEJMoa2301972"}]'::jsonb
),
(
  'aod-9604', 'AOD-9604', ARRAY['Anti-Obesity Drug 9604','AOD9604'], 'metabolic', 'HUMAN_OBS', false,
  'Modified C-terminal fragment (aa 176-191) of hGH studied for adipose breakdown without growth-axis effects.',
  'Fragment of growth hormone proposed to stimulate lipolysis and inhibit lipogenesis. Lacks the metabolic actions of full-length hGH on IGF-1 / insulin sensitivity at typical research doses.',
  'sc',
  ARRAY['No standard monitoring established outside trials', 'Track adherence + side-effect diary'],
  ARRAY['Pregnancy', 'Active malignancy'],
  ARRAY['Insufficient long-term safety data', 'Variable potency by source'],
  ARRAY['Injection-site reaction', 'Mild headache (uncommon)'],
  ARRAY['Long-term safety not well characterized'],
  '[]'::jsonb
),
(
  'ghk-cu', 'GHK-Cu', ARRAY['Copper Peptide','Glycyl-Histidyl-Lysine'], 'tissue_repair', 'HUMAN_OBS', false,
  'Copper tripeptide investigated for skin/tissue repair and anti-inflammatory effects.',
  'Tripeptide that complexes with copper(II). In vitro and limited human data suggest modulation of wound healing, collagen synthesis, and antioxidant pathways.',
  'sc',
  ARRAY['Track local reactions at injection site'],
  ARRAY['Active malignancy', 'Wilson disease'],
  ARRAY['Copper-restricted diet', 'Pregnancy (insufficient data)'],
  ARRAY['Injection-site irritation', 'Skin discoloration at site (rare)'],
  ARRAY['Excess copper accumulation with very high exposures (theoretical)'],
  '[]'::jsonb
),
(
  'bpc-157', 'BPC-157', ARRAY['Body Protection Compound 157'], 'tissue_repair', 'ANIMAL', false,
  'Synthetic pentadecapeptide derived from a gastric protein. Animal data on tissue repair; no FDA approval and limited human clinical evidence.',
  'Proposed effects on angiogenesis, growth-factor pathways, and nitric oxide signaling driving tissue repair in animal studies.',
  'sc',
  ARRAY['Side-effect diary; no validated biomarker monitoring'],
  ARRAY['Active malignancy', 'Pregnancy'],
  ARRAY['Anticoagulation use (theoretical bleeding risk)', 'Insufficient human safety data'],
  ARRAY['Injection-site reaction', 'Mild fatigue (uncommon)'],
  ARRAY['Long-term safety in humans not established'],
  '[]'::jsonb
),
(
  'tb-500', 'TB-500', ARRAY['Thymosin Beta-4 fragment'], 'tissue_repair', 'ANIMAL', false,
  'Thymosin-beta-4 derivative studied in animals for tissue regeneration and inflammation modulation.',
  'Binds G-actin and may modulate cell migration, angiogenesis, and inflammation in tissue repair.',
  'sc',
  ARRAY['Side-effect diary; no validated biomarker monitoring'],
  ARRAY['Active malignancy', 'Pregnancy'],
  ARRAY['Insufficient human safety data', 'Limited clinical evidence'],
  ARRAY['Injection-site reaction', 'Mild lethargy (uncommon)'],
  ARRAY['Long-term safety in humans not established'],
  '[]'::jsonb
),
(
  'kpv', 'KPV', ARRAY['Lysine-Proline-Valine','Lys-Pro-Val'], 'tissue_repair', 'ANIMAL', false,
  'C-terminal tripeptide of α-MSH; investigated in animals for anti-inflammatory effects.',
  'Modulates NF-κB and other inflammatory signaling pathways; subject of GI inflammation research models.',
  'oral',
  ARRAY['Side-effect diary'],
  ARRAY['Pregnancy'],
  ARRAY['Insufficient human safety data'],
  ARRAY['GI upset (rare)'],
  ARRAY['Long-term safety in humans not established'],
  '[]'::jsonb
),
(
  'mots-c', 'MOTS-C', ARRAY['Mitochondrial Open Reading Frame of 12S rRNA-c'], 'longevity', 'ANIMAL', false,
  'Mitochondrial-derived peptide studied in animals for metabolic regulation.',
  'Encoded within mitochondrial 12S rRNA. Animal data on AMPK activation, glucose disposal, and exercise capacity.',
  'sc',
  ARRAY['Fasting glucose / A1c if metabolic baseline relevant', 'Side-effect diary'],
  ARRAY['Pregnancy'],
  ARRAY['Insufficient human safety data'],
  ARRAY['Injection-site reaction (uncommon)'],
  ARRAY['Long-term safety in humans not established'],
  '[]'::jsonb
),
(
  'nad-plus', 'NAD+', ARRAY['Nicotinamide Adenine Dinucleotide'], 'longevity', 'HUMAN_OBS', false,
  'Coenzyme involved in cellular redox and SIRT enzyme function; studied for energy metabolism and longevity.',
  'Substrate for sirtuins and PARPs. Tissue NAD+ declines with age; precursor strategies (NR, NMN) more commonly used than direct NAD+.',
  'iv',
  ARRAY['IV-route requires clinician administration', 'Watch flushing / chest tightness with rapid infusion'],
  ARRAY['Active malignancy (relative to high doses)'],
  ARRAY['Pregnancy (insufficient data)', 'Active infection'],
  ARRAY['Nausea during IV infusion', 'Flushing', 'Headache'],
  ARRAY['Anaphylactoid reaction (rare)'],
  '[]'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  aliases = excluded.aliases,
  category = excluded.category,
  evidence_level = excluded.evidence_level,
  fda_approved = excluded.fda_approved,
  short_description = excluded.short_description,
  mechanism = excluded.mechanism,
  typical_route = excluded.typical_route,
  monitoring_notes = excluded.monitoring_notes,
  absolute_contraindications = excluded.absolute_contraindications,
  relative_contraindications = excluded.relative_contraindications,
  common_side_effects = excluded.common_side_effects,
  serious_adverse_events = excluded.serious_adverse_events,
  citations = excluded.citations;
