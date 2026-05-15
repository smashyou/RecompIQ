# PRD — Peptide Body Recomposition Expert Agent

**Status:** Draft v0.1
**Date:** 2026-05-14
**Owner:** Solo dev (jryu)

---

## 1. Vision

A premium, AI-powered web + mobile platform that helps adults pursue evidence-
informed body recomposition. The product combines a personalized AI coach,
peptide protocol tracking, photo-based food logging, weight projection
modeling, and biomarker tracking — under a strict **non-prescribing** safety
boundary that treats all peptide doses as user- or clinician-supplied.

## 2. Core promise to the user

> "Log what you take, eat, and feel. I'll project where you'll be in 6 months,
> tell you when the data looks off, surface the relevant research, and help
> you have a sharper conversation with your clinician."

## 3. Non-goals

- ❌ Prescribing experimental peptide doses.
- ❌ Replacing clinician care or labs.
- ❌ Claiming experimental compounds are proven.
- ❌ Selling, sourcing, or linking to vendors.
- ❌ Diagnosing conditions.

## 4. Target users (personas)

| Persona | Primary need | Notes |
|---|---|---|
| **P1 — Obese / high BMI** (e.g. Demo User A) | Aggressive but safe fat loss | Often deconditioned, comorbidities (T2D, HTN, neuro) |
| **P2 — T2D / insulin-resistant** | Glycemic control + fat loss | GLP-1 stacks common, careful side-effect monitoring |
| **P3 — Athletes / bodybuilders** | Recomp / lean mass | Higher protein targets, training volume tracking |
| **P4 — Longevity / aging** | Healthspan, recovery | NAD+, MOTS-C, GHK-Cu — low-intensity protocols |
| **P5 — Injury recovery** | Tissue repair | KLOW-style stacks, range-of-motion tracking |
| **P6 — Clinician-guided users** | Adherence + data | They have a prescriber; we track and warn |
| **P7 — Researchers / educators** | Evidence summaries | Read-only knowledge surfaces |

All personas share the same data model; the AI coach personalizes guidance.

## 5. Success metrics (MVP)

| Metric | Target |
|---|---|
| New user → first daily log | < 24h, > 70% activation |
| 7-day retention | > 45% |
| Coach response satisfaction (thumbs-up rate) | > 75% |
| Photo-food log accuracy (user-corrected items / total items) | corrections < 25% |
| Weight-projection MAE @ week 4 | < 3 lb |
| Safety-alert false-positive rate | < 15% |
| Zero unsanctioned dose recommendations emitted by AI | 100% |

## 6. Module map (P0 = MVP, P1 = next)

| # | Module | Priority | Notes |
|---|---|---|---|
| 1 | Onboarding (profile + goals + conditions + medications) | P0 | Drives every downstream personalization |
| 2 | Dashboard | P0 | Weight, macros, peptides, vitals, AI insights |
| 3 | Daily logging | P0 | Weight, vitals, mood, side effects |
| 4 | Food logging via USDA / OFF | P0 | Manual + saved meals + meal builder |
| 5 | Weight projection engine | P0 | Conservative / target / aggressive + ETA |
| 6 | Peptide tracker | P0 | Compound, dose, route, site, time, side effects |
| 7 | Reconstitution calculator | P0 | mg/mL, mL to draw, insulin-unit conversion |
| 8 | Workout tracking (phased) | P0 | Phase-aware (P1 walking → P3 progressive overload) |
| 9 | Safety alert engine | P0 | Rule-based + AI-confirmed alerts |
| 10 | AI coach chat | P0 | Streaming, source-grounded, contraindication-aware |
| 11 | Photo food logging | P1 | Vision provider: OpenAI / Gemini / Claude (toggle) |
| 12 | Auto peptide stacker | P1 | Educational framework generator |
| 13 | Biomarker / lab tracking | P1 | A1c, fasting glucose, lipids, etc. |
| 14 | Export / import (JSON + CSV) | P1 | User data sovereignty |
| 15 | Mobile parity (Expo) | P1 | After web MVP stabilizes |

## 7. Safety boundary (product principle)

The AI agent **educates, tracks, and warns**. It never prescribes. All numeric
doses originate from the user (typed in) or a clinician-supplied protocol
imported by the user. Every dose display ships with:

1. An **evidence level badge** (FDA / RCT / OBS / ANIMAL / MECH / ANECDOTAL).
2. A **contraindication check** against the user's profile.
3. A **clinician-discussion disclaimer**.

The auto-stacker is explicitly framed as an **educational framework** —
it ranks compounds by evidence and surfaces contraindications; it does not
ship a "Day 1: X mg" protocol.

## 8. Demo User A (built-in sample profile)

See `CLAUDE.md` for full spec. Used for product demos, development, and as the
canonical end-to-end test fixture. Flag `is_demo = true` on every row.

## 9. AI inputs / outputs (high level)

**Inputs the coach has access to:**
- profile (age, sex, anthropometrics, conditions, meds, allergies)
- goals (target weight, timeline, phase preferences)
- last 90 days of: weight, macros, vitals, peptide doses, workouts, sleep,
  side effects, free-text notes
- evidence-graded peptide knowledge base (RAG)

**Outputs the coach can produce:**
- Nutrition target ranges (calories, protein, carbs, fat, fiber)
- Workout phase recommendations (walking/mobility → bands → progressive)
- Recovery / sleep / hydration guidance
- Lab-test recommendations (which to ask clinician for)
- Monitoring checklists per active compound
- Progress projections + plateau forecasts
- Warnings, contraindication flags, clinician discussion points

**Outputs the coach must NOT produce:**
- Doses, frequencies, routes, durations for any compound the user did not enter
- Statements that an experimental compound is "safe" or "proven"
- Diagnosis claims

## 10. Compliance / privacy posture

- HIPAA-**inspired** architecture (not certified): RLS on every user-scoped
  table, signed URLs for blobs, AES-256 at rest (Supabase default), TLS in
  transit.
- Data sovereignty: full JSON + CSV export; one-click account delete
  (`DELETE /api/me`) cascades through Postgres + Blob.
- AI prompt logs scoped per-user, redactable, included in export.

## 11. Open questions (parked)

- Q1: Do we want offline-first mobile (SQLite + sync) or strictly online MVP?
- Q2: Do we ship a "shared with clinician" read-only link in P0 or P1?
- Q3: Wearables — Apple Health / Google Fit / Whoop / Oura — P1 or P2?
- Q4: i18n — English-only MVP confirmed?
