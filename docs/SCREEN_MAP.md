# Screen Map — Peptide Body Recomposition Expert Agent

**Status:** Draft v0.1
**Date:** 2026-05-14

---

## Routing legend

- `(marketing)` — public, unauthenticated
- `(auth)` — auth flows
- `(app)` — authenticated app shell, has sidebar + topbar
- `[id]` — Next.js dynamic segment
- Mobile screens listed alongside; web is primary for MVP.

---

## 1. Marketing (public)

| Route | Purpose | Notes |
|---|---|---|
| `/` | Landing — hero, value props, demo CTA | Demo opens `?demo=1` deep link |
| `/pricing` | (P1) | Free + Pro tiers |
| `/about` | About + safety boundary explainer | |
| `/legal/terms` | ToS | |
| `/legal/privacy` | Privacy policy + HIPAA-inspired note | |
| `/legal/safety` | The safety boundary in plain language | |

## 2. Auth

| Route | Purpose |
|---|---|
| `/signin` | Email/password + magic-link |
| `/signup` | New account |
| `/reset` | Password reset request |
| `/reset/[token]` | Set new password |
| `/verify` | Email verify landing |

## 3. App shell

```
(app)/layout.tsx
  ├── <Sidebar/>
  │     ├── Dashboard
  │     ├── Coach
  │     ├── Log (quick entry)
  │     ├── Food
  │     ├── Peptides
  │     ├── Workouts
  │     ├── Projections
  │     ├── Alerts
  │     ├── Labs
  │     └── Settings
  ├── <Topbar/> (user menu, dark/light toggle, search)
  └── {children}
```

## 4. Onboarding (modal-flow, not full pages)

| Step | Screen | Inputs |
|---|---|---|
| 1 | Welcome | — |
| 2 | About you | Age, sex, height, weight, units |
| 3 | Your goal | Goal weight, timeline, phase preference |
| 4 | Health conditions | Multi-select chips (T2D, HTN, etc.) + free text |
| 5 | Medications | Add list |
| 6 | Injuries / limits | Add list |
| 7 | Current peptides? | Optional stack import |
| 8 | Vision provider | OpenAI / Gemini / Claude pick |
| 9 | Plan preview | Coach-generated plan preview + safety disclaimer |
| 10 | Done → dashboard | |

## 5. Dashboard — `/dashboard`

Cards (grid, mobile-stack):

1. **Weight card** — current, vs. start, vs. target, weekly avg, sparkline.
2. **Projection card** — mini 3-line chart, ETA badge.
3. **Today's macros** — protein/carbs/fat/calories ring + target.
4. **Vitals strip** — last BP, glucose, HR.
5. **Peptide adherence** — 14-day grid, % adherent.
6. **Symptoms** — today's mood/energy/pain emoji row.
7. **AI insight of the day** — coach-generated, dismissible.
8. **Safety alerts** — banner if any unacknowledged.
9. **Workout** — today's prescribed session card.

## 6. Coach — `/coach`

- Thread list (left rail).
- Main panel: streaming chat, message-level citation chips, tool-call cards
  (e.g., "Logged 8oz chicken (42g protein)").
- Right rail: "Today's plan" snapshot + "Discussion points for your clinician".
- Slash commands inside input:
  - `/log` → quick log
  - `/explain <compound>` → evidence-graded summary
  - `/labs` → lab recommendation generator

## 7. Quick Log — `/log`

Tabs (one screen, segmented control):
- Weight
- Vitals
- Symptoms
- Sleep
- Water
- Steps

Each tab: minimal-fields form, large buttons, "Save & next" pattern.

## 8. Food

| Route | Purpose |
|---|---|
| `/food` | Today's meals + macro totals |
| `/food/log` | Add a meal — search foods, set portions |
| `/food/photo` | Snap or upload a photo → AI parse → confirm |
| `/food/meals/saved` | Saved meals library |
| `/food/meals/builder` | Multi-ingredient meal builder |
| `/food/barcode` | Mobile: barcode scanner |

## 9. Peptides

| Route | Purpose |
|---|---|
| `/peptides` | Active stack overview |
| `/peptides/stacks` | Stack list (active + historical) |
| `/peptides/stacks/[id]` | Stack detail (items, schedule, evidence, contraindications) |
| `/peptides/stacks/new` | Create stack (manual) |
| `/peptides/dose-log` | Calendar of doses (heatmap) |
| `/peptides/compounds` | Compound catalog (browse + search) |
| `/peptides/compounds/[slug]` | Compound detail (evidence, mechanism, refs, monitoring) |
| `/peptides/reconstitution` | Calculator UI |
| `/peptides/stacker` | Auto-stacker Q&A flow |
| `/peptides/stacker/result/[runId]` | Stacker output (educational framework) |

## 10. Workouts

| Route | Purpose |
|---|---|
| `/workouts` | This week's plan + history |
| `/workouts/new` | Log a session |
| `/workouts/templates` | Phase-aware templates |
| `/workouts/[id]` | Session detail (exercises, sets, reps, load) |

## 11. Projections — `/projections`

- Main chart: actual + 7-day MA + 3 projection lines + target band.
- ETA card.
- Plateau forecast.
- Adherence score.
- Toggle: 8 / 13 / 26 / 52 weeks.

## 12. Alerts — `/alerts`

- Active alerts (severity grouped).
- History (acknowledged, dismissed).
- "Why am I seeing this?" expandable on each alert (shows the rule + data points).

## 13. Labs — `/labs`

- Timeline view of lab results (A1c, fasting glucose, lipids, etc.).
- Manual entry form.
- Trend mini-charts.

## 14. Settings — `/settings`

| Subroute | Purpose |
|---|---|
| `/settings/account` | Email, password, delete account |
| `/settings/profile` | Edit profile fields |
| `/settings/goals` | Edit goal + timeline |
| `/settings/units` | lb/kg, in/cm, glucose mg/dL vs mmol/L |
| `/settings/notifications` | Reminders (dose, weigh-in, meal) |
| `/settings/ai` | Vision provider, coach tone, data scope |
| `/settings/export` | JSON / CSV download |
| `/settings/import` | Upload a previous export |
| `/settings/integrations` | (P1) Apple Health, Google Fit, Whoop |

## 15. Mobile (Expo Router) — P1

Mirrors web minus marketing pages. Mobile-first features:
- Barcode scanner (`/food/barcode`)
- Camera-first photo food logging
- Push reminders (dose, weigh-in)
- Quick-log bottom sheet (one-tap glucose, weight, dose)

## 16. Cross-cutting components

| Component | Where it appears |
|---|---|
| `<SafetyDisclaimer/>` | Every peptide / dose / coach plan view |
| `<EvidenceBadge level="HUMAN_RCT"/>` | Compound details, coach citations |
| `<ContraindicationBanner/>` | Stack detail + stacker result |
| `<ProjectionChart/>` | Dashboard mini + Projections page |
| `<MacroRing/>` | Dashboard + Food page |
| `<DoseHeatmap/>` | Peptides dose-log |
| `<AlertCard severity=.../>` | Alerts page + dashboard |
| `<CoachInsightCard/>` | Dashboard + Coach right rail |
| `<DemoBadge/>` | Anywhere demo data is rendered |
