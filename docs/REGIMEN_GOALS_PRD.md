# PRD — Goal-driven Regimen, Logging & "Whole Picture"

> Status: **DRAFT for review** (2026-05-31). No code until approved.
> Author: product + eng. Supersedes the ad-hoc "stacks" model for the peptide
> tracking surface. Non-negotiable: everything here stays inside the
> **non-prescribing safety boundary** (educate, track, project, flag — never
> prescribe; evidence-grade everything; no fabricated doses).

---

## 1. Problem & vision

**Today** the app models **"stacks"** as the primary object. The user thinks in
terms of **"my regimen right now, toward my goals."** That mismatch creates the
friction we see:

- Adding a peptide mid-phase makes a *new stack* → two "Phase 1" cards (confusing).
- The compound picker is a flat 49-chip wall — hard to find anything.
- Reconstitution "Save this mix" writes a record nothing else reads (dead end).
- Cost is asked inline because there's no inventory; no spend tracking.
- Projections only know weight; the user's actual goals (skin, healing, muscle,
  cognition…) aren't tracked or projected.
- The flow is page-hop heavy: dashboard → peptides → new stack → reconstitution →
  dose log are islands.

**Vision.** *Logging shouldn't be rocket science.* One coherent mental model —
**Goals → a single living Regimen (phased over time) → simple logging → one
whole-picture view** — with the AI coach helping assemble and adjust it. The user
should, from the dashboard, add/adjust a peptide mid-phase in seconds, and see
projected progress for **each goal they chose** (weight, muscle, skin, healing,
cognition, …), plus what it's costing them, over **any date range**.

**Design principles**
1. **One regimen, not many stacks.** Phases are time segments of the same regimen.
2. **Edit in place.** Add/adjust from where you are (drawer/sheet), no page-hopping.
3. **Everything connects.** Reconstitution → protocol item → dose log → inventory →
   cost → projections all share one spine.
4. **Goal-driven.** Goals decide what we track, suggest, and project.
5. **AI assists, never prescribes.** Suggestions are evidence-graded, contraindication-
   checked, clinician-pointed; the user (or clinician) always decides.
6. **Calm + honest.** Projections are illustrative, never promised outcomes.

---

## 2. Goal taxonomy (expanded, catalog-grounded)

Researched against the 49-compound catalog. Each goal maps to representative
compounds (evidence varies — graded in-app, never presented as proven/safe) and
to **measurable signals** + a **projection approach**. Compounds listed are
*descriptive capability mapping*, not recommendations.

| # | Goal | Representative compounds (graded in-app) | Logged signals | Projection |
|---|---|---|---|---|
| 1 | **Fat loss / recomposition** | Retatrutide, Semaglutide, Tirzepatide, Survodutide, Mazdutide, Cagrilintide, AOD-9604, HGH-frag 176-191, Tesofensine, 5-Amino-1MQ, MOTS-c | weight, waist, body-fat%, photos | weight trajectory (existing engine) |
| 2 | **Muscle gain / strength** | Ipamorelin, CJC-1295, Sermorelin, Tesamorelin, GHRP-2/6, Hexarelin, MK-677, IGF-1 LR3, Follistatin | lift loads (from workouts), bodyweight/lean mass, limb circumference, photos | strength + lean-trend |
| 3 | **Injury healing / tissue repair / recovery** | BPC-157, TB-500, KPV, GHK-Cu (KLOW), ARA-290, Pentadeca Arginate, Pentosan | pain 0–10 + mobility/ROM for the area, milestone checklist, symptoms | recovery curve |
| 4 | **Skin quality / dermal anti-aging** | GHK-Cu, Epitalon, NAD+, Glutathione | skin self-rating 1–10, hydration, face/skin photos | trend + photo timeline |
| 5 | **Hair restoration** | GHK-Cu, TB-500, PTD-DBM | density self-rating, shed count, hairline/crown photos | trend + photo compare |
| 6 | **Cognitive enhancement / focus / neuroprotection** | Semax, Selank, Dihexa, P21, Cerebrolysin, BPC-157 (gut-brain) | focus/clarity 1–10, brief reaction/memory check-in, mood | trend |
| 7 | **Longevity / cellular aging / "youth"** | Epitalon, NAD+, Humanin, SS-31, MOTS-c, Thymalin | composite of energy/sleep/recovery + (optional) biomarkers/labs | composite index trend |
| 8 | **Energy / mitochondrial vitality** | MOTS-c, SS-31, 5-Amino-1MQ, NAD+ | energy 1–10, RHR/HRV (vitals), steps | trend |
| 9 | **Sleep quality** | DSIP, Epitalon | sleep duration + quality (existing), latency, awakenings | trend |
| 10 | **Immune resilience** | Thymosin Alpha-1, Thymalin, LL-37, VIP | sick-days, symptom log, energy | trend |
| 11 | **Sexual health / libido** | PT-141, Kisspeptin, Gonadorelin | libido/function self-rating 1–10 | trend |
| 12 | **Gut health** | BPC-157, KPV, Larazotide, VIP, LL-37 | GI symptom score, bloating/regularity | trend |
| 13 | **Mood / stress resilience** | Selank, Semax, DSIP | mood/stress 1–10, sleep | trend |

> Most non-weight goals are **subjective 1–10 scales + photos + a few objective
> signals** (weight, strength, vitals, sleep, labs). That's honest and lawful:
> presented as *self-tracked trends*, evidence-graded, never an efficacy claim.

**Projection framing (per goal):** the **actual trend is always shown**; an
**illustrative projection** is layered on top *only* where literature supports a
direction, grounded in cited ranges, labeled *"illustrative — not a predicted
outcome,"* and routed through `packages/peptides/safety.ts` + the
`safety-reviewer` gate. Weight uses the existing 3-line engine; others reuse a
generalized version of it (§6).

---

## 3. Goal capture (onboarding + anytime)

Two complementary inputs, both feeding the same goal set:

**A. Pick from the list (multi-select).** Cards for the goals above, each with a
one-line "what it tracks" + representative compound chips + evidence note. User
can select several.

**B. Natural-language box.** *"I want to drop ~40 lb, then put on muscle, and my
skin + sleep could be better."* → the **AI coach parses intent → goals** (maps to
the taxonomy) → proposes an **evidence-graded stack (incl. blends like KLOW)** per
goal, with contraindication checks against the user's profile + clinician-discussion
points. Output is *suggestions the user accepts/edits*, never auto-applied.

**Multi-goal reality check + phasing.** If the user selects too many goals/compounds
at once, the system **warns** ("8 compounds across 4 goals at once is hard to run,
track, and afford, and some aims conflict — e.g. aggressive fat-loss vs muscle
gain") and **proposes a phased plan**:
- *P1 — Fat loss* → *P2 — Muscle gain* → *P3 — Youth + Cognitive (together)* …
- The proposed phases become the **Regimen's phase timeline** (§4). User can
  reorder, merge, or run concurrently (with the warning acknowledged).

This is the **AI auto-stacker** (was "Phase 10") reframed as goal-driven. Powered
by the existing gateway (`packages/agent`) + catalog + `compound_synergies` +
`contraindications.ts`. Every suggested dose is `wrapDoseLike()`-quarantined and
carries the evidence badge + disclaimer.

---

## 4. Data model changes

### 4.1 Regimen (replaces "stacks" as the primary object)
- **`regimens`** — one active per user (history retained). `{ id, user_id,
  title, is_active, created_at }`.
- **`regimen_phases`** — sequential time segments. `{ id, regimen_id, ordinal,
  name, goal_ids[], starts_on, ends_on(null=current), notes }`. *Replaces the
  per-stack "phase" string — you can never have two "P1" cards.*
- **`regimen_items`** — a compound (or blend) in the regimen. `{ id, regimen_id,
  phase_id, compound_id|blend_id, dose_value, dose_unit, route, frequency,
  schedule_id(null), starts_on, ends_on(null), source('user'|'clinician'|'ai_suggested') }`.
- **`regimen_changes`** — append-only change log (versioning). `{ id, regimen_id,
  item_id, kind('add'|'edit'|'stop'|'dose_change'|'phase_advance'), before jsonb,
  after jsonb, effective_on, created_at }`. *This is the spine that makes adherence
  + projections honest about what was active when.*

> **Migration:** existing `peptide_stacks`/`peptide_stack_items` → fold the active
> stack into one `regimen` with a single current phase; map items 1:1; preserve
> `peptide_doses` (FK stays compound-based). Reversible. `schema-guardian` review +
> RLS on every new table.

### 4.2 Inventory & expenses
- **`peptide_purchases`** — `{ id, user_id, compound_id|blend_id, vial_mg,
  vial_count, price_usd, vendor, purchased_on, notes }`.
- **Derived cost-per-dose** = active vial price ÷ doses-per-vial (reconstitution
  already computes doses/vial). No more inline "vial cost."
- **Spend aggregation** over any date range: total $, by compound, **$/lb lost**
  (and $/goal-metric), via a query over purchases + the regimen timeline.

### 4.3 Goal metrics
- **`user_goals`** — `{ id, user_id, goal_key, priority, status('active'|'queued'|
  'done'), target jsonb, created_at }` (multiple, prioritized, phase-linkable).
- **`goal_metrics`** — generic metric log. `{ id, user_id, metric_key
  (e.g. 'skin_quality','focus','pain_left_foot','arm_circumference'), value,
  unit, logged_at, note }`. Reuses existing `weights`/`vitals`/`sleep_logs`/
  `symptoms` where they already cover a signal; adds the subjective scales +
  circumference/photo metrics.
- Photos: extend `body_photos` with an `angle/kind` so face/skin/hair shots live
  alongside physique shots, tagged to a goal.

---

## 5. Screens & flows (the simplification)

### 5.1 Dashboard = the whole picture
- **Per-goal progress cards** (one per active goal): current value + trend
  sparkline + illustrative projection + evidence badge. Weight card stays; others
  appear as goals are chosen.
- **Active regimen card** — current phase + items; each row tappable to **edit**;
  an inline **"+ Add peptide"** opens the add drawer (§5.3) — *no page hop*.
- **Spend snapshot** — this-cycle $ + "see expenses."
- **Today's log** + coach insight.
- Entry to the **unified timeline** (§5.5).

### 5.2 Regimen page (replaces "Peptides" stack list)
- **One regimen**, phases shown as a **timeline** (P1 done · P2 current · P3 queued),
  each phase = its goals + items + a **change history** ("added KLOW · day 17").
- Actions: add item, edit/stop item, **advance phase**, edit phase goals.
- No "New stack" button; "New regimen" only for starting over.

### 5.3 Add / edit a peptide (inline drawer — the core fix)
A single sheet, reachable from dashboard + regimen:
1. **Pick compound** → uses the **Protocol Library list as the picker** (search +
   category groups + filter chips: category / evidence / route / **goal-relevance**;
   "suggested for your goals" up top). Blends (KLOW) are one pickable item,
   **expandable** to components.
2. **Set dose / route / frequency / start date.** Literature ranges shown
   (DoseAnnotatedText, quarantined) as reference — user enters their own.
3. **If injectable → reconstitution is a step right here** (not a separate page),
   prefilled; shows draw volume + syringe.
4. **Save fork:** *Add to protocol* (default) · *Add & log first dose* · *Save to
   inventory*. Appends a `regimen_item` + `regimen_change(add, effective_on)` and
   **re-runs projections**. Contraindication check + clinician prompt before commit.

### 5.4 Reconstitution
- Standalone page stays, but **"Save this mix" becomes the fork above** (attach to
  a protocol item / log a dose / save to inventory) — never a dead record.
- **Blends expandable everywhere:** tap KLOW → GHK-Cu / BPC-157 / TB-500 / KPV
  sub-list (the per-component math already exists on this page; reuse in lists).

### 5.5 Inventory & expenses (new)
- Log purchases (compound, mg, price, vendor, date, qty).
- Auto cost-per-dose; **date-range spend** with breakdowns + $/lb-lost.

### 5.6 Goal logging + unified timeline (new)
- **Quick log / FAB** gains goal-metric inputs (skin/focus/energy/pain 1–10,
  circumference, sleep, etc.) per the user's active goals + photo capture.
- **Unified timeline:** pick any date range → one view of doses, active peptides,
  food/calories, training + calories burned, weight + each goal metric, and spend.
  The cause→effect "whole picture."

---

## 6. Projections (generalized + safe)
- Generalize the weight engine (`packages/projections`) into a metric-agnostic
  trend+band projector: input a metric series + an optional literature-derived
  expected-direction/rate → output actual trend + conservative/target/aggressive
  illustrative lines + a target band.
- **Per goal**, only project where literature supports a direction; otherwise show
  the trend only. Every projection: evidence badge, *"illustrative — not a predicted
  outcome,"* clinician prompt; runs through `safety.ts` + `safety-reviewer`.
- Weight keeps today's behavior; muscle = strength/lean trend; subjective goals =
  self-rating trend (+ optional gentle projection where evidenced, e.g. GHK-Cu skin).

---

## 7. AI auto-stacker (goal → suggested regimen)
- Input: chosen goals (+ NL text) + profile (conditions/meds/injuries) + history.
- Output: per-phase suggested items (compounds/blends) with evidence grade,
  literature dose *range* (quarantined), contraindication report, monitoring +
  clinician-discussion points, and a **phasing plan** when goals/compounds are too
  many or conflicting.
- Strictly non-prescriptive: suggestions the user accepts/edits; nothing auto-applied;
  all dose text `wrapDoseLike()`-tagged; safety gate before display.

---

## 8. Delivery roadmap (phased)
1. **Regimen model + migration** (regimens/phases/items/changes; fold stacks). + RLS,
   schema-guardian.
2. **Inline add/edit drawer** (library-as-picker + reconstitution-as-step + save fork)
   from dashboard + regimen. Fixes screenshot issues #1–#4.
3. **Inventory & expenses** (#5) + auto cost-per-dose + range aggregation.
4. **Goal model + capture** (list + NL + AI auto-stacker + phasing warnings),
   onboarding integration.
5. **Goal metrics logging** + generalized projections + per-goal dashboard cards.
6. **Unified timeline.**
7. Mobile parity throughout (web + mobile per the standing directive).

Each phase: typecheck + Vercel deploy gate; `safety-reviewer` on any dose/projection
path; no fabricated doses; evidence + disclaimer on every compound/dose/projection.

---

## 9. Open decisions (for review)
1. **Concurrent goals** — allow running multiple goals in one phase (with the
   warning) or hard-encourage sequential phases? (Proposal: allow, but default the
   AI to a phased plan.)
2. **Goal projection ambition — DECIDED: option 2** (always-on actual trend + an
   illustrative, literature-grounded projection layered on top; evidence-graded,
   "not a predicted outcome," safety-gated). Remaining sub-question: *which goals*
   get a projection line in v1 vs trend-only until their evidence model is graded.
   (Proposal: projection for weight + muscle + skin/GHK from day one; trend-only for
   the rest, promoting each to a projection as `evidence-researcher` + `safety-reviewer`
   sign off on its literature basis.)
3. **Subjective scales** — define the canonical 1–10 metrics + any quick cognitive
   check-in (e.g., a 30-sec reaction/memory task) or keep it self-rating only for v1.
4. **Labs/biomarkers** — pull the deferred Labs OCR in for longevity/metabolic goals,
   or keep labs out of v1?
5. **Migration timing** — one-shot stacks→regimen migration vs. dual-read transition.
