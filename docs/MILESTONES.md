# Milestones — Peptide Body Recomposition Expert Agent

**Status:** Draft v0.1
**Date:** 2026-05-14

Phases are sized for a solo dev with AI assistance. Each phase has a clear
**Definition of Done**; we don't move on until those boxes are checked. All
phases land on `main`; feature branches optional (solo).

---

## Phase 0 — Foundations

**Goal:** Empty monorepo → buildable, deployable, authenticated shell.

- [ ] `pnpm` workspace + Turborepo
- [ ] `apps/web` (Next.js 15 App Router) scaffolded with Tailwind v4 + shadcn/ui
- [ ] `packages/{shared,ui,agent,projections,nutrition,peptides}` empty workspaces with TS configs
- [ ] `vercel.ts` configured (no `vercel.json`)
- [ ] Supabase project provisioned; local dev via `supabase start`
- [x] `supabase/migrations/20260514000000_init.sql` applied to remote (profiles + enums + RLS)
- [ ] Supabase Auth wired with `@supabase/ssr`
- [ ] `/signin`, `/signup`, `/reset` working
- [ ] App shell with sidebar + topbar
- [ ] `/api/me` returns the current user
- [ ] First deploy to Vercel preview URL successful
- [ ] `.env.example` complete; `pnpm dev` runs cleanly from a fresh clone

**DoD:** sign up → land on empty dashboard → sign out → sign back in.

---

## Phase 1 — Onboarding

**Goal:** New user can complete a 9-step onboarding and have their profile,
goals, conditions, meds, and injuries stored.

- [ ] Modal flow with progress indicator
- [ ] Zod schemas for each step in `packages/shared/schemas/onboarding/`
- [ ] `/api/onboarding/*` routes
- [ ] `goals` + `profiles` + `conditions` + `medications` + `injuries` tables migrated
- [ ] Demo user A seed wired to `/seed-demo` command
- [ ] Onboarding completion triggers first plan generation (placeholder until Phase 7)

**DoD:** Demo user A can be seeded; new user can onboard end-to-end.

---

## Phase 2 — Dashboard skeleton

**Goal:** A working dashboard with empty-state cards + real data when present.

- [ ] All cards (weight, projection, macros, vitals, adherence, symptoms,
      insight, alerts, workout) — empty-state versions
- [ ] Recharts integration for weight sparkline
- [ ] Demo user A renders with seeded data

**DoD:** Demo user dashboard looks "real". Empty new user gets graceful empty states.

---

## Phase 3 — Daily logging

**Goal:** Users can log weight, vitals, symptoms, sleep, water, steps.

- [ ] `weights`, `vitals`, `symptoms`, `sleep_logs`, `water_logs`, `steps_logs` migrations
- [ ] `/log/*` route handlers + Zod schemas with medical-bound checks
- [ ] `/log` quick-entry page with tabbed interface
- [ ] Dashboard wires to real data
- [ ] `audit_log` trigger on `vitals` + `peptide_doses`

**DoD:** All daily values land in DB, render on dashboard, and are exportable.

---

## Phase 4 — Food logging (manual + APIs)

**Goal:** Users can search foods, log meals, save meals, build multi-ingredient meals.

- [ ] `packages/nutrition/` adapters: USDA → OFF → Nutritionix fallback chain
- [ ] `foods`, `food_logs`, `saved_meals`, `meal_ingredients` migrations
- [ ] `/food` page + log + saved meals + meal builder
- [ ] `/api/food/*` routes
- [ ] Barcode lookup (web mock; mobile uses camera)
- [ ] Dashboard "Today's macros" card live

**DoD:** Demo user can log a full day of meals and see the macro ring fill.

---

## Phase 5 — Weight projection engine

**Goal:** Conservative / target / aggressive projection lines + ETA on demand.

- [ ] `packages/projections/` — pure-function engine, fully unit-tested
- [ ] `weight_projections` table + `/api/projections/*` routes
- [ ] Cron: nightly recompute
- [ ] `<ProjectionChart/>` component with target band + 7-day MA
- [ ] `/projections` page

**DoD:** Demo user A shows projection ETA at 26 weeks; numbers match hand calcs.

---

## Phase 6 — Peptide tracker + reconstitution

**Goal:** Stack + dose tracking + reconstitution calculator.

- [ ] `compounds` table seeded (Retatrutide, KLOW components, MOTS-C, NAD+, AOD 9604, Tesa, Ipa)
- [ ] `peptide_stacks`, `peptide_stack_items`, `peptide_doses`, `reconstitution_records` migrations
- [ ] `/peptides/*` pages
- [ ] `/api/stacks/*`, `/api/doses/*`, `/api/reconstitution/*` routes
- [ ] `packages/peptides/reconstitution.ts` (mg/mL, mL-to-draw, insulin units)
- [ ] `packages/peptides/contraindications.ts` rules
- [ ] `<EvidenceBadge/>`, `<SafetyDisclaimer/>`, `<ContraindicationBanner/>`
- [ ] safety-reviewer agent runs in CI (manual trigger for now)

**DoD:** Demo user A's Phase-1 stack (Retatrutide + AOD-9604 + KLOW) renders
with evidence + contraindications; calculator outputs match a worked example.

---

## Phase 7 — Workout tracking

**Goal:** Phase-aware workout logging.

- [ ] `workouts`, `workout_exercises`, `mobility_sessions` migrations
- [ ] Phase 1 / 2 / 3 templates seeded
- [ ] `/workouts` + log + templates pages
- [ ] Dashboard "Today's workout" card live

**DoD:** Demo user A sees a P1 walking + mobility plan; can log a session.

---

## Phase 8 — Safety alert engine

**Goal:** Rule-based alerts firing automatically.

- [ ] `safety_alerts` migration
- [ ] `packages/peptides/alerts.ts` rules (rapid weight loss, low protein,
      nausea, BP/glucose thresholds, neuro worsening, adherence drop, stack risk)
- [ ] `/api/cron/safety-scan` every 15 min
- [ ] `/alerts` page + dashboard banner
- [ ] User acknowledge flow

**DoD:** Synthetic test data triggers each rule; demo user A surfaces 1-2
realistic alerts.

---

## Phase 9 — AI coach

**Goal:** Streaming coach chat, source-grounded, contraindication-aware,
non-prescribing.

- [ ] `packages/agent/gateway.ts` (single chokepoint to Vercel AI Gateway)
- [ ] `packages/agent/coach/` system prompt + tools (logFood, recommendLab, flagSafety)
- [ ] `peptide_kb` table + `pgvector` + seed loader (FDA + curated PubMed)
- [ ] `ai_conversations`, `ai_messages`, `ai_insights`, `coach_recommendations` migrations
- [ ] `/coach` page with streaming via AI SDK v6 `useChat`
- [ ] Daily insight cron
- [ ] Post-response safety regex + safety-reviewer agent in dev
- [ ] Coach refuses dose prompts ("can you tell me how much retatrutide to take")
      and pivots to educational framing

**DoD:** Demo user A has a productive coach conversation; safety guardrails
verified by 10 adversarial prompts.

---

## Phase 10 — Auto peptide stacker

**Goal:** Educational framework generator (NOT prescriptive).

- [ ] `/api/stacker/*` routes (Q&A state machine)
- [ ] `/peptides/stacker` flow
- [ ] Evidence-ranked compound list output with contraindication report
- [ ] "Save as draft stack" path requires user to fill in doses (NOT auto-filled)

**DoD:** Demo user A walks through stacker → gets an educational framework
that explicitly does not contain doses.

---

## Phase 11 — Photo food logging

**Goal:** Snap → AI parse → confirm → log.

- [ ] `packages/agent/vision/` with provider toggle (OpenAI / Gemini / Claude)
- [ ] `food_photo_assets` table + Vercel Blob private bucket
- [ ] `/api/food/photo/upload` + `/api/food/photo/parse`
- [ ] `/food/photo` page (web upload)
- [ ] User must confirm parsed items before save
- [ ] Settings: per-user vision provider preference

**DoD:** Test photo → 3 items detected → user edits one → meal saves with macros.

---

## Phase 12 — Export / import + account delete

- [ ] `/api/me/export?format=json|csv`
- [ ] `/api/me` DELETE with cascade (Postgres + Blob purge)
- [ ] Settings UI for both

**DoD:** Full round-trip of demo user A through export → import → identical state.

---

## Phase 13 — Mobile parity (Expo)

**Goal:** Read-mostly mobile companion → progressive parity.

- [ ] `apps/mobile/` Expo + Expo Router scaffold
- [ ] Auth + dashboard read-only
- [ ] Quick-log bottom sheet
- [ ] Barcode scanner (P1.5)
- [ ] Camera-first photo food logging
- [ ] Push reminders

**DoD:** Demo user A can sign in on Expo Go, view dashboard, quick-log weight,
take a food photo.

---

## Phase 14 — Polish + launch

- [ ] Landing page + pricing (if applicable)
- [ ] Legal pages (terms, privacy, safety boundary)
- [ ] Lighthouse 90+ on landing + dashboard
- [ ] Sentry wired (web + server)
- [ ] AI Gateway dashboard reviewed; rate limits tuned
- [ ] Production deploy on custom domain

---

## Tracking

- One GitHub project (or local TodoWrite) per phase.
- After each phase: run `/ship` command, then `/safety-check` if the phase
  touched peptides / coach.
- Demo user A acts as the canonical fixture for every phase.
