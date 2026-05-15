# API Route Map — Peptide Body Recomposition Expert Agent

**Status:** Draft v0.1
**Surface:** Next.js 15 App Router Route Handlers at `apps/web/app/api/**`
**Runtime:** Node.js on Vercel Fluid Compute (no Edge)
**Auth:** Supabase session cookie; helper `await requireUser()` throws 401 if missing.
**Validation:** every request body + response goes through a Zod schema from `packages/shared/schemas/`.

---

## Conventions

- `POST` for creates, `PATCH` for partial updates, `PUT` for full replace,
  `DELETE` for removals, `GET` for reads.
- All responses: `{ data, error }` shape (error is `null` on success).
- Pagination: `?cursor=<created_at>&limit=20` (cursor-based).
- Date filters: `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Streaming endpoints: marked `(stream)` — return `text/event-stream`.

---

## 1. Auth + account

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` | Email + password signup (proxies Supabase) |
| POST | `/api/auth/signin` | Email + password signin |
| POST | `/api/auth/signout` | Clear session |
| POST | `/api/auth/magic-link` | Send magic link |
| POST | `/api/auth/reset` | Trigger password reset |
| GET  | `/api/me` | Current user + profile summary |
| PATCH| `/api/me` | Update profile fields |
| DELETE| `/api/me` | Delete account (cascades, 30-day soft delete) |
| GET  | `/api/me/export?format=json\|csv` | Full data export |

## 2. Onboarding

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/onboarding/state` | What step user is on |
| POST | `/api/onboarding/profile` | Age, sex, height, weight, units |
| POST | `/api/onboarding/goals` | Goal weight, timeline, phase |
| POST | `/api/onboarding/conditions` | T2D, HTN, allergies, etc. |
| POST | `/api/onboarding/medications` | Current meds |
| POST | `/api/onboarding/injuries` | Active/historical injuries |
| POST | `/api/onboarding/complete` | Marks onboarding done; triggers initial coach plan |

## 3. Daily logging (single-shot endpoints)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/log/weight` | `{ value, unit, logged_at, note? }` |
| GET  | `/api/log/weight?from&to` | Series for charts |
| POST | `/api/log/measurement` | Waist/hip/neck/etc. |
| POST | `/api/log/vital` | BP, HR, glucose, ketones, temp |
| POST | `/api/log/symptom` | Nausea, mood, pain, neuro |
| POST | `/api/log/sleep` | Bed/wake/duration/quality |
| POST | `/api/log/water` | Volume |
| POST | `/api/log/steps` | Count |
| GET  | `/api/log/today` | Today's combined snapshot for dashboard |
| GET  | `/api/log/range?from&to&kinds[]=` | Multi-series fetch |

## 4. Food

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/food/search?q=` | USDA + OFF + cache search |
| GET  | `/api/food/barcode?upc=` | OFF + Nutritionix barcode lookup |
| POST | `/api/food/log` | Log a meal (foods + portions) |
| GET  | `/api/food/log?from&to` | List meals |
| PATCH| `/api/food/log/:id` | Edit a meal |
| DELETE| `/api/food/log/:id` | Delete a meal |
| POST | `/api/food/saved-meal` | Save a custom meal |
| GET  | `/api/food/saved-meal` | List saved meals |
| POST | `/api/food/photo/upload` | Multipart → Vercel Blob |
| POST | `/api/food/photo/parse` | `{ asset_id, provider }` → vision parse |
| GET  | `/api/food/macros/today` | Calorie + macro totals for today |

## 5. Peptides

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/compounds` | List master compound catalog |
| GET  | `/api/compounds/:slug` | Compound detail + evidence-graded refs |
| GET  | `/api/stacks` | User's stacks (active + historical) |
| POST | `/api/stacks` | Create a new stack |
| PATCH| `/api/stacks/:id` | Update stack metadata |
| POST | `/api/stacks/:id/items` | Add a compound to a stack |
| PATCH| `/api/stacks/:id/items/:item_id` | Edit a stack item |
| DELETE| `/api/stacks/:id/items/:item_id` | Remove a stack item |
| POST | `/api/doses` | Log a dose taken |
| GET  | `/api/doses?from&to` | Dose history |
| PATCH| `/api/doses/:id` | Edit a dose |
| DELETE| `/api/doses/:id` | Delete a dose |
| POST | `/api/reconstitution/calc` | mg+water+desired → mg/mL, mL, units |
| POST | `/api/reconstitution/save` | Persist a calc for a vial |
| GET  | `/api/reconstitution/history` | Past calcs |
| POST | `/api/peptides/side-effects` | Log side effects tied to a dose |

## 6. Workouts

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/workouts?from&to` | Sessions list |
| POST | `/api/workouts` | Create a session |
| PATCH| `/api/workouts/:id` | Edit a session |
| POST | `/api/workouts/:id/exercises` | Add exercise to a session |
| POST | `/api/mobility` | Lighter logging for P1 mobility/walking |
| GET  | `/api/workouts/templates?phase=` | Phase-appropriate templates |

## 7. AI Coach (streaming)

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/coach/conversations` | List threads |
| POST | `/api/coach/conversations` | Start a new thread |
| GET  | `/api/coach/conversations/:id/messages` | Backfill |
| POST | `/api/coach/chat` (stream) | Streaming chat completion with tool calls |
| POST | `/api/coach/plan/generate` | Generate / refresh the personalized plan |
| GET  | `/api/coach/plan/latest` | Latest plan + version |
| POST | `/api/coach/insights/today` | On-demand insight generation |
| GET  | `/api/coach/insights?from&to` | Insight history |
| POST | `/api/coach/recommendations/:id/accept` | Accept a coach rec |
| POST | `/api/coach/recommendations/:id/dismiss` | Dismiss + reason |

## 8. Auto peptide stacker (educational framework, NOT prescriptive)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/stacker/start` | Begin Q&A → returns first clarifying question |
| POST | `/api/stacker/answer` | Submit answer → next question OR finalize |
| GET  | `/api/stacker/result/:run_id` | Evidence-ranked framework + contraindication report |
| POST | `/api/stacker/result/:run_id/save-as-stack` | Materialize as draft stack (still requires user edits) |

## 9. Projections

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/projections/weight` | Current series: conservative / target / aggressive + ETA |
| POST | `/api/projections/recompute` | Force recompute (also runs nightly via cron) |
| GET  | `/api/projections/adherence` | Adherence score over time |

## 10. Safety alerts

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/alerts` | List active + recent alerts |
| POST | `/api/alerts/:id/acknowledge` | User ack |
| POST | `/api/alerts/scan` | Force a scan (also nightly cron) |
| GET  | `/api/alerts/rules` | What's being checked + thresholds |

## 11. Labs / biomarkers

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/labs` | Manual lab entry |
| GET  | `/api/labs?from&to` | History |
| POST | `/api/labs/import` | Photo OCR of a lab printout (P1) |

## 12. Settings

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/settings` | All user settings |
| PATCH| `/api/settings` | Update units, theme, vision provider, notifications |
| POST | `/api/settings/notifications/test` | Send a test notification |

## 13. Cron-only routes (Vercel Crons, `x-vercel-cron-signature` validated)

| Method | Path | Schedule |
|---|---|---|
| POST | `/api/cron/safety-scan` | every 15 min |
| POST | `/api/cron/projection-refresh` | nightly 03:00 |
| POST | `/api/cron/daily-insights` | daily 09:00 |
| POST | `/api/cron/kb-refresh` | weekly (peptide_kb embedding refresh) |

## 14. Errors

Single error envelope:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "human readable",
    "fieldErrors": { "weight.value": "must be between 50 and 800" }
  }
}
```

Codes:
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_FAILED` (422)
- `RATE_LIMITED` (429)
- `SAFETY_BLOCKED` (451) — request rejected by safety guard
- `UPSTREAM_FAILED` (502) — nutrition / AI provider failure
- `INTERNAL` (500)

## 15. Rate limits (per user, per hour)

| Surface | Limit |
|---|---|
| Coach chat | 60 |
| Photo parse | 30 |
| Food search | 300 |
| Other writes | 600 |
