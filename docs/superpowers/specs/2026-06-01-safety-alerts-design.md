# Safety Alerts + Audit Log — Design Spec

> Phase 8 of the roadmap + the long-deferred `audit_log` carryover, combined.
> Status: approved 2026-06-01. One combined implementation plan. Web + mobile.

## 1. Goal

Turn the stubbed safety-alert engine into a real, persisted, evidence-graded
system that watches the user's own logged data and surfaces **observations to
discuss with a clinician** — never instructions, never doses. Pull the
safety-critical `audit_log` forward so every alert state change (and the existing
sensitive tables) is audited.

Non-negotiable: this is educational + tracking. An alert says *what was observed*
and *"discuss with your clinician,"* with an evidence grade + citation. It never
prescribes, dictates a dose, or tells the user to start/stop a compound.

## 2. The core principle (drives the whole engine)

**Alert on numbers, not guesses.** Every rule fires off a measurable value
compared to a published threshold. Where the relevant signal is normally fuzzy
free-text (nerve symptoms, nausea severity), we do NOT guess from the words.
Instead, for users the signal applies to, we collect a quick **numeric
self-check anchored with relatable example sentences**, and the rule fires off
that number. If a relevant self-check is missing, the engine emits a gentle
`info` nudge to log it — converting "we can't tell" into "please measure."

Free-text notes are still stored and shown as supporting context on an alert,
but are NEVER the trigger.

## 3. Scope (one combined plan, build order within it)

1. **Audit-log foundation** — `audit_log` table + generic trigger on the
   safety-critical tables. Lands first because the `alerts` table reuses it.
2. **The engine** — pure `scanRecentLogs` across all 12 `ALERT_KIND`s.
3. **Measured self-checks** — anchored numeric inputs for the soft domains
   (neuro, nausea severity), reusing the existing metric/symptom logging.
4. **Persistence + lifecycle** — `alerts` table, reconcile-on-load, ack/snooze.
5. **Surfaces** — `/alerts` page, dashboard banner, topbar count (web) + an
   Alerts screen (mobile).
6. **Evidence + safety passes**, demo seed, gates.

## 4. Audit log

`audit_log` table:
`id, table_name, row_id, user_id, op ('insert'|'update'|'delete'), actor (auth.uid()), before jsonb, after jsonb, changed_at timestamptz`.

- A generic `audit_row_change()` trigger function (`SECURITY DEFINER`) attached
  to: **`lab_results`, `peptide_doses`, `vitals`, `weights`, and `alerts`.**
- RLS: a user may `SELECT` their own audit rows; there is **no client INSERT/
  UPDATE/DELETE policy** — only the trigger writes (via `SECURITY DEFINER`).
- `before`/`after` store the row as jsonb (full row on insert/delete, both on
  update). No raw PII echoed to logs (rule 5) — this is row data at rest under
  RLS, not stdout.
- Reversible migration; schema-guardian review required.

## 5. The engine — `packages/peptides/src/alerts.ts` (pure)

`scanRecentLogs(input: AlertScanInput): AlertFinding[]`

`AlertScanInput` is a typed bundle of recent logs (no DB access in the engine):
weights series, vitals series, symptoms series (incl. nausea, appetite, the
neuro self-check rating), recent protein totals + goal min, doses + adherence
over a window, active regimen compounds (with contraindication arrays), and the
user's conditions/medications/injuries.

`AlertFinding`:
```ts
interface AlertFinding {
  kind: AlertKind;          // one of the 12 enum values
  severity: AlertSeverity;  // 'info' | 'warn' | 'critical'
  title: string;            // short label
  message: string;          // observation + clinician framing, NEVER an instruction
  evidence: Record<string, unknown>; // the data that triggered it (for the card + audit)
  evidenceLevel: EvidenceLevel;      // graded; from the rule catalog
  citation: string;         // e.g. "ADA Standards of Care 2025"
  fingerprint: string;      // stable dedup key: kind + the salient bucket (see §7)
}
```

One pure rule function per kind. Thresholds live in an `ALERT_RULES` catalog
(kind → threshold(s) + severity mapping + evidenceLevel + citation), finalized by
the **evidence-researcher pass before coding**. New harness `pnpm test:alerts`:
each rule gets a trigger case, a just-below-threshold non-trigger case, and a
severity-escalation case where applicable.

## 6. The 12 rules

Hard-number rules (fire directly off logged numbers):

| Kind | Trigger (proposed; evidence-researcher finalizes) | Severity | Citation source |
|---|---|---|---|
| `glucose_low` | < 70 → warn · < 54 → critical | warn/critical | ADA hypoglycemia |
| `glucose_high` | > 180 → warn · > 250 → critical (sick-day) | warn/critical | ADA |
| `bp_high` | ≥140/90 → warn · ≥180/120 → critical (crisis) | warn/critical | AHA/ACC 2017 |
| `bp_low` | <90/60 with a symptom present | warn | standard |
| `rapid_weight_loss` | >2 lb/wk sustained ≥2 wk → warn · >3–4 lb/wk → critical | warn/critical | GLP-1 label caution |
| `low_protein` | avg protein over recent logged days < goal min | info/warn | user's own target |
| `adherence_drop` | dose adherence < ~70% over recent window | info/warn | derived |
| `unsafe_stack` | `evaluateContraindications`: absolute → critical, relative → warn | warn/critical | CI catalog |

Soft domains (fire off an anchored **numeric self-check**, never free-text):

| Kind | Measured signal | Trigger | Severity |
|---|---|---|---|
| `neuro_worsening` | neuro self-check 0–10 (anchored, §8) | rises ≥2 over recent baseline, or ≥7 absolute | warn (critical if "new weakness/can't feel" anchor) |
| `severe_nausea` | nausea-severity self-check 0–10 (anchored) | ≥7, or ≥4 for ≥3 consecutive days | warn · critical if paired with dehydration signs |
| `dehydration` | low water_logs + GI symptoms + a thirst/dizziness check | combined measured proxy crosses threshold | warn |
| `side_effect_cluster` | count of distinct measured AE signals in a window | ≥3 distinct concurrent | info/warn |

If a soft domain applies to the user (they have the relevant condition/injury or
are on a compound with that AE profile) but there's **no recent self-check**, the
engine emits a gentle `info` finding: *"Quick check: log your [foot numbness]
today so we can track it."* — the "please measure" nudge, not an alarm.

**Every `message` is observation + clinician framing.** Examples:
- warn: *"Your last 3 readings average 168 g/dL fasting glucose, above the 130
  target you set — worth raising with your clinician."*
- critical: *"A blood pressure of 184/121 is in the range clinicians call a
  hypertensive crisis. If you have chest pain, vision change, or trouble
  speaking, seek care now; otherwise contact your clinician promptly."*
Never: "take X," "increase your dose," "stop retatrutide."

## 7. Persistence + lifecycle — `alerts` table

Columns:
`id, user_id, kind, severity, fingerprint, title, message, evidence jsonb, evidence_level, citation, status ('open'|'acknowledged'|'resolved'), first_detected_at, last_detected_at, acknowledged_at, snoozed_until, resolved_at, is_demo, created_at`.

- RLS: 4 policies (select/insert/update/delete own). Writes also go through the
  `audit_log` trigger (§4).
- **Dedup `fingerprint`**: `kind` + a coarse "bucket" of the salient value so the
  same ongoing situation maps to one row (e.g. `bp_high:crisis`,
  `rapid_weight_loss:2026-W22`, `unsafe_stack:<compoundSlug>:<conditionKey>`).
  Distinct genuine instances get distinct fingerprints.
- **Reconcile-on-load** (server, in the dashboard + `/alerts` loaders):
  1. Run the engine over recent logs → findings.
  2. For each finding: `upsert` by `(user_id, fingerprint)` — existing row →
     bump `last_detected_at` (+ severity if it escalated); none → insert `open`.
  3. Open rows whose fingerprint is no longer in the findings → `resolved`
     (`resolved_at = now`) — auto-clear.
  4. `acknowledged` rows are NOT re-opened while their fingerprint persists (no
     re-nag); a new fingerprint = a new alert.
  5. `snoozed_until > now` → hidden from active surfaces, still in the table.
- This reconcile is the single audited write-path for alerts.

## 8. Measured self-checks (the anchored inputs)

Reuse the existing metric pattern (`goal_metrics` + quick-log; these already flow
into the timeline). Add measured keys with **anchored example sentences** shown
beside the 0–10 control, surfaced only when relevant (user has the condition/
injury, or is on a compound with that AE profile):

- `neuro_severity` (0–10), anchors:
  - 0 "No numbness or weakness."
  - 3 "Mild tingling on long walks (my usual)."
  - 6 "Numb most of the day; foot feels heavy."
  - 9 "Can't feel my foot, or it gives out / new weakness."
- `nausea_severity` (0–10), anchors:
  - 0 "No nausea." · 3 "Slight queasiness." · 6 "Nauseous much of the day;
    eating is hard." · 9 "Vomiting or can't keep fluids down."

These log like any metric (RLS already on `goal_metrics`), appear on the
timeline, and are the **trigger source** for the matching soft rules. Free-text
`neuro_note` stays as optional context shown on the alert card.

## 9. Surfaces (web + mobile)

- **`/alerts` page** (new — today the nav/topbar link 404s): active alerts grouped
  `critical → warn → info`; each card = title, observation message, evidence
  detail, **EvidenceBadge + citation**, clinician prompt, actions **Acknowledge**
  and **Snooze 7d**; a collapsed **Resolved/History** section; `SafetyDisclaimer`.
- **Dashboard banner**: replace the stopgap `deriveAlerts` (`components/dashboard/
  derive.ts`) with the engine's open `critical`/`warn` (top N) → links to
  `/alerts`. Keep the file's role; swap the source.
- **Topbar bell**: red dot + count shown **only** when open un-acked
  `critical`/`warn` exist (today it's hardcoded always-on).
- **API**: `GET /api/alerts` (active + history), `POST /api/alerts/[id]/ack`,
  `POST /api/alerts/[id]/snooze`. Reconcile runs server-side in the loaders;
  ack/snooze are Zod-validated route handlers writing through the audited path.
- **Mobile**: an Alerts screen (More → Alerts, with a badge) — same grouped list +
  ack/snooze via the API (or supabase-js read + a reconcile call), `SafetyDisclaimer`.

## 10. Safety gates

- **evidence-researcher** grounds + grades every threshold + citation **before**
  coding (writes the `ALERT_RULES` catalog values).
- **safety-reviewer** on the engine + every alert message string (non-prescribing,
  clinician framing, no dose/instruction; critical copy includes "seek care if…"
  without prescribing).
- **schema-guardian** on both migrations (`audit_log`, `alerts`) — RLS present,
  FKs correct, triggers sound, reversible.
- Never auto-acts; the user always takes the clinical action.

## 11. Testing + demo

- `pnpm test:alerts` — pure engine, per-rule trigger/non-trigger/escalation.
- typecheck 16/16 · migrations via `node scripts/db-apply.mjs` · `expo export -p ios`
  · Playwright `/alerts` at 390px (no overflow, alerts render).
- Extend `scripts/seed-demo.mjs` so Demo User A trips several **real** alerts from
  the already-seeded data: `bp_high` (baseline ~138–152/86+), `glucose_high`
  (baseline ~150–226), possibly `rapid_weight_loss` (retatrutide arc), plus a
  seeded `neuro_severity` self-check series that trends and a `low_protein` day —
  so `/alerts` is populated and the ack/snooze flow is demoable. All `is_demo`.

## 12. Out of scope (v1)

- Push/email notifications for alerts (in-app only this phase).
- AI/LLM interpretation of alerts (the coach can reference them later; the engine
  itself is deterministic rules only).
- Background/cron scanning (reconcile is on-load only).
- Acknowledge-with-note / per-alert clinician export (history view only).
