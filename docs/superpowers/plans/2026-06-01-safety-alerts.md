# Safety Alerts + Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the real, persisted, evidence-graded safety-alert engine (all 12 `ALERT_KIND`s) that watches the user's logged data and surfaces clinician-discussion observations (never doses/instructions), with acknowledge/snooze, plus the long-deferred `audit_log` on the safety-critical tables.

**Architecture:** A pure, data-driven engine in `@peptide/peptides/alerts` evaluates a typed `AlertScanInput` against an `ALERT_RULES` catalog (thresholds/severity/evidence/citation, finalized by an evidence-researcher pass) using a handful of generic evaluators; a pure `reconcileAlerts` diffs findings against stored rows. Server loaders reconcile-on-load into an audited `alerts` table; web `/alerts` + dashboard banner + topbar and a mobile screen render it. Soft signals (nerve symptoms, nausea) fire off anchored numeric self-checks, never free-text.

**Tech Stack:** TypeScript (strict), Supabase Postgres (RLS + triggers), Next.js 15 Route Handlers + SSR, Zod, Expo/React Native, tsx test harnesses.

**Spec:** `docs/superpowers/specs/2026-06-01-safety-alerts-design.md`

**Conventions (carry in):**
- Commit author `John Ryu <johnminryu@gmail.com>`, NO Claude co-author trailer, `--no-verify`. Run `git status --short` AFTER every `git add`.
- Gates: `pnpm turbo run typecheck` (16/16) · `pnpm test:alerts` · migrations via `node scripts/db-apply.mjs <file>` · `cd apps/mobile && npx expo export -p ios` · Playwright `/alerts` at 390px · Vercel deploy READY.
- **Non-prescribing:** every alert message is an observation + "discuss with your clinician"; never a dose or instruction. `safety-reviewer` gates the engine + all copy; `schema-guardian` gates both migrations.
- **Client/server boundary** (learned last phase): client components import pure logic from `@peptide/*` packages, NEVER a value from a `server-only` loader.

---

## File Structure

**Shared (`@peptide/shared`):**
- Create `packages/shared/src/alerts/types.ts` — `AlertScanInput`, `AlertFinding`, `EvidenceLevel` re-use; the `AlertRule` catalog type.
- Create `packages/shared/src/alerts/rules.ts` — `ALERT_RULES` catalog (one entry per kind: thresholds, severity mapping, `evidenceLevel`, `citation`). Values finalized by evidence-researcher (Task 3).
- Create `packages/shared/src/alerts/index.ts` — barrel; add `"./alerts"` export to `packages/shared/package.json`.
- Modify `packages/shared/src/goals/metrics.ts` — add `neuro_severity`, `nausea_severity` measured keys + optional `anchors` on `MetricDef`.
- Modify `packages/shared/src/schemas/` — `alertAckInput`, `alertSnoozeInput`.

**Engine (`@peptide/peptides`):**
- Modify `packages/peptides/src/alerts.ts` — replace the stub with the real `scanRecentLogs`, generic evaluators, `fingerprintOf`, and the pure `reconcileAlerts`.
- Create `scripts/test-alerts.mjs` — harness; add `test:alerts` to root `package.json`.

**Migrations:**
- Create `supabase/migrations/<ts>_audit_log.sql` — `audit_log` + `audit_row_change()` + triggers on `lab_results, peptide_doses, vitals, weights`.
- Create `supabase/migrations/<ts>_alerts.sql` — `alerts` table + RLS + audit trigger.

**Web:**
- Create `apps/web/lib/queries/alerts.ts` — `loadAlerts(userId)` (build input → scan → reconcile → return active+history).
- Create `apps/web/lib/alerts-input.ts` — build `AlertScanInput` from DB rows (shared by loader + reconcile).
- Create `apps/web/app/(app)/alerts/page.tsx` + `alerts-client.tsx`.
- Create `apps/web/app/api/alerts/route.ts` (GET), `apps/web/app/api/alerts/[id]/ack/route.ts`, `apps/web/app/api/alerts/[id]/snooze/route.ts`.
- Modify `apps/web/components/dashboard/derive.ts` (or the dashboard loader) — source the banner from the engine.
- Modify `apps/web/components/topbar.tsx` — real count.
- Modify the quick-log surface — add neuro/nausea self-check inputs when relevant.

**Mobile:**
- Create `apps/mobile/lib/alerts.ts` — reader + reconcile call.
- Create `apps/mobile/app/(tabs)/more/alerts.tsx` — screen.
- Modify `apps/mobile/app/(tabs)/more/index.tsx` — Alerts row + badge.
- Modify the mobile quick-log — neuro/nausea self-check inputs.

**Demo:** Modify `scripts/seed-demo.mjs`.

---

## Task 1: Audit-log migration

**Files:**
- Create: `supabase/migrations/20260601200000_audit_log.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260601200000_audit_log.sql`:

```sql
-- Audit log for safety-critical tables (schema-guardian carryover).
-- A generic trigger records before/after row state on insert/update/delete.
-- RLS: a user reads only their own audit rows; ONLY the SECURITY DEFINER trigger
-- writes (no client write policy). Row data at rest under RLS — not stdout.

create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  row_id      uuid,
  user_id     uuid references auth.users(id) on delete cascade,
  op          text not null check (op in ('insert','update','delete')),
  actor       uuid,                 -- auth.uid() when available
  before      jsonb,
  after       jsonb,
  changed_at  timestamptz not null default now()
);
create index if not exists audit_log_user_idx on audit_log(user_id, changed_at desc);
create index if not exists audit_log_table_row_idx on audit_log(table_name, row_id);

alter table audit_log enable row level security;
create policy audit_log_select on audit_log for select using (auth.uid() = user_id);
-- No insert/update/delete policies: writes happen only via the trigger below.

-- Generic audit trigger. Reads user_id from the row (all target tables have it).
create or replace function audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_row_id uuid;
begin
  if (tg_op = 'DELETE') then
    v_user := old.user_id;
    v_row_id := old.id;
    insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
      values (tg_table_name, v_row_id, v_user, 'delete', auth.uid(), to_jsonb(old), null);
    return old;
  elsif (tg_op = 'UPDATE') then
    v_user := new.user_id;
    v_row_id := new.id;
    insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
      values (tg_table_name, v_row_id, v_user, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    v_user := new.user_id;
    v_row_id := new.id;
    insert into audit_log(table_name, row_id, user_id, op, actor, before, after)
      values (tg_table_name, v_row_id, v_user, 'insert', auth.uid(), null, to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists audit_lab_results on lab_results;
create trigger audit_lab_results after insert or update or delete on lab_results
  for each row execute function audit_row_change();
drop trigger if exists audit_peptide_doses on peptide_doses;
create trigger audit_peptide_doses after insert or update or delete on peptide_doses
  for each row execute function audit_row_change();
drop trigger if exists audit_vitals on vitals;
create trigger audit_vitals after insert or update or delete on vitals
  for each row execute function audit_row_change();
drop trigger if exists audit_weights on weights;
create trigger audit_weights after insert or update or delete on weights
  for each row execute function audit_row_change();

-- DOWN (run manually to reverse):
--   drop trigger if exists audit_lab_results on lab_results;
--   drop trigger if exists audit_peptide_doses on peptide_doses;
--   drop trigger if exists audit_vitals on vitals;
--   drop trigger if exists audit_weights on weights;
--   drop function if exists audit_row_change();
--   drop table if exists audit_log;
```

- [ ] **Step 2: schema-guardian review**

Dispatch the `schema-guardian` agent over this migration. Expected: RLS present (select-own, no client writes), trigger is `SECURITY DEFINER` with pinned `search_path`, reversible. Address any blockers.

- [ ] **Step 3: Apply + verify**

Run: `node scripts/db-apply.mjs supabase/migrations/20260601200000_audit_log.sql`
Then verify a write is audited (psql/REST): insert a demo weight and confirm an `audit_log` row appears with `op='insert'` and `after` populated. (Use the demo user id `11111111-1111-1111-1111-111111111111`.)
Expected: one audit row per write.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601200000_audit_log.sql
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(audit): audit_log table + generic trigger on safety-critical tables" --no-verify
```

---

## Task 2: Shared alert types + catalog shape

**Files:**
- Create: `packages/shared/src/alerts/types.ts`
- Create: `packages/shared/src/alerts/rules.ts`
- Create: `packages/shared/src/alerts/index.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Write the types**

Create `packages/shared/src/alerts/types.ts`:

```ts
import type { AlertKind, AlertSeverity, EvidenceLevel } from "../enums";

// ---- engine inputs (platform loaders build this from DB rows) ----
export interface AlertScanInput {
  weights: { logged_at: string; value_lb: number }[];      // ascending
  vitals: { logged_at: string; bp_systolic: number | null; bp_diastolic: number | null; glucose_mgdl: number | null }[]; // descending (latest first)
  proteinByDay: { day: string; protein_g: number }[];      // recent days
  proteinGoalMin: number | null;
  doses: { taken_at: string; adherence: string }[];        // recent window
  metrics: { metric_key: string; value: number; logged_at: string }[]; // self-checks (neuro_severity, nausea_severity…)
  symptoms: { logged_at: string; nausea: boolean | null }[];
  waterByDay: { day: string; ml: number }[];
  activeCompounds: { slug: string; name: string; absolute_contraindications: string[]; relative_contraindications: string[] }[];
  health: { conditions: string[]; medications: string[]; injuries: string[]; age: number | null; sex: string | null };
  now: string; // ISO; passed in (engine stays pure — no Date.now())
}

export interface AlertFinding {
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;                     // observation + clinician framing, never an instruction
  evidence: Record<string, unknown>;   // the data that triggered it
  evidenceLevel: EvidenceLevel;
  citation: string;
  fingerprint: string;                 // stable dedup key
}

// ---- rule catalog (values finalized by evidence-researcher, Task 3) ----
export interface AlertRule {
  kind: AlertKind;
  /** numeric cut points; meaning depends on the evaluator (see engine). */
  warnAt?: number;
  criticalAt?: number;
  /** direction: 'high' = value above cut triggers; 'low' = below. */
  direction?: "high" | "low";
  evidenceLevel: EvidenceLevel;
  citation: string;
  /** title + message templates; {v} interpolated with the salient value. */
  title: string;
  messageWarn: string;
  messageCritical?: string;
}
```

- [ ] **Step 2: Write the catalog skeleton (placeholder values, finalized in Task 3)**

Create `packages/shared/src/alerts/rules.ts` with one entry per kind. Use the proposed values from the spec §6 as the starting point (Task 3 verifies/finalizes them). Example entries (write ALL 12 following this shape):

```ts
import type { AlertRule } from "./types";

// NOTE: thresholds + citations finalized by the evidence-researcher pass (plan Task 3).
// Each carries an EvidenceLevel + citation so the UI can show an EvidenceBadge.
export const ALERT_RULES: Record<string, AlertRule> = {
  glucose_low: {
    kind: "glucose_low", direction: "low", warnAt: 70, criticalAt: 54,
    evidenceLevel: "FDA_APPROVED", citation: "ADA Standards of Care (hypoglycemia <70 mg/dL)",
    title: "Low blood glucose",
    messageWarn: "A reading of {v} mg/dL is below 70, which clinicians call low blood sugar — worth discussing with your clinician.",
    messageCritical: "A reading of {v} mg/dL is in the range of severe hypoglycemia. If you feel confused, shaky, or faint, treat per your clinician's hypoglycemia plan and seek help.",
  },
  glucose_high: {
    kind: "glucose_high", direction: "high", warnAt: 180, criticalAt: 250,
    evidenceLevel: "FDA_APPROVED", citation: "ADA Standards of Care (hyperglycemia / sick-day)",
    title: "High blood glucose",
    messageWarn: "Your reading of {v} mg/dL is above 180 — bring it up with your clinician.",
    messageCritical: "A reading of {v} mg/dL is high enough that clinicians advise sick-day precautions; contact your clinician.",
  },
  bp_high: {
    kind: "bp_high", direction: "high", warnAt: 140, criticalAt: 180,
    evidenceLevel: "FDA_APPROVED", citation: "ACC/AHA 2017 BP guideline",
    title: "Elevated blood pressure",
    messageWarn: "Your last reading {v} is at or above 140/90 — keep discussing your blood pressure with your clinician.",
    messageCritical: "A blood pressure of {v} is in the range clinicians call a hypertensive crisis. If you have chest pain, vision change, or trouble speaking, seek care now; otherwise contact your clinician promptly.",
  },
  // ... write the remaining 9: bp_low, rapid_weight_loss, low_protein, adherence_drop,
  // unsafe_stack, neuro_worsening, severe_nausea, dehydration, side_effect_cluster.
  // unsafe_stack/side_effect_cluster don't use warnAt/criticalAt numerics — keep
  // evidenceLevel/citation/title/messages; the engine evaluator supplies severity.
};
```

> Write every one of the 12 keys. For `unsafe_stack` use `evidenceLevel: "HUMAN_OBS"` + `citation: "Compound contraindication catalog"`; for `side_effect_cluster` use `evidenceLevel: "ANECDOTAL"`. `neuro_severity`/`nausea_severity`-driven kinds use `direction: "high"`, `warnAt`/`criticalAt` on the 0–10 scale.

- [ ] **Step 3: Barrel + export**

Create `packages/shared/src/alerts/index.ts`:

```ts
export * from "./types";
export * from "./rules";
```

In `packages/shared/package.json` `exports`, add after `"./labs/shape"`:

```json
    "./labs/shape": "./src/labs/shape.ts",
    "./alerts": "./src/alerts/index.ts"
```

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add packages/shared/src/alerts packages/shared/package.json
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): shared alert types + rule catalog skeleton" --no-verify
```

---

## Task 3: Finalize ALERT_RULES via evidence-researcher

**Files:**
- Modify: `packages/shared/src/alerts/rules.ts`

- [ ] **Step 1: Dispatch evidence-researcher**

Dispatch the `evidence-researcher` agent with this prompt: *"For each safety-alert threshold below, confirm or correct the numeric cut point against reputable clinical sources (ADA Standards of Care, ACC/AHA 2017 BP guideline, FDA GLP-1/tirzepatide labels for GI AEs + dehydration/AKI, standard hypotension refs), and return for each: the warn/critical cut, an EvidenceLevel from {FDA_APPROVED, HUMAN_RCT, HUMAN_OBS, ANIMAL, MECHANISTIC, ANECDOTAL}, and a one-line citation. Kinds: glucose_low, glucose_high, bp_high, bp_low, rapid_weight_loss (lb/week sustained), low_protein (relative to user's own target — no external cut), severe_nausea (0–10 self-check + duration), dehydration, neuro_worsening (0–10 self-check delta/absolute), adherence_drop (%), side_effect_cluster (count), unsafe_stack (contraindication-driven, no numeric). These are for non-prescriptive 'discuss with clinician' alerts, not dosing."*

- [ ] **Step 2: Apply the researched values**

Update each `ALERT_RULES[kind]` `warnAt`/`criticalAt`/`evidenceLevel`/`citation` with the researcher's findings. Keep any value the researcher could not source flagged with the most conservative cut + `ANECDOTAL` + an honest citation ("conservative default — no strong source").

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add packages/shared/src/alerts/rules.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): evidence-graded thresholds + citations (evidence-researcher)" --no-verify
```

---

## Task 4: The engine — evaluators + scanRecentLogs (TDD)

**Files:**
- Modify: `packages/peptides/src/alerts.ts`
- Create: `scripts/test-alerts.mjs`
- Modify: `package.json` (root)

- [ ] **Step 1: Write the test harness with failing tests**

Create `scripts/test-alerts.mjs`:

```js
#!/usr/bin/env node
// Test harness for the safety-alert engine. Runs via `pnpm test:alerts`.
import assert from "node:assert/strict";
import { scanRecentLogs, fingerprintOf } from "../packages/peptides/src/alerts.ts";

let passed = 0, failed = 0;
function it(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n     ${e.message}`); failed++; }
}

const NOW = "2026-06-01T12:00:00Z";
const base = () => ({
  weights: [], vitals: [], proteinByDay: [], proteinGoalMin: 160,
  doses: [], metrics: [], symptoms: [], waterByDay: [],
  activeCompounds: [], health: { conditions: [], medications: [], injuries: [], age: 42, sex: "male" },
  now: NOW,
});

it("glucose_high critical fires above the critical cut", () => {
  const input = { ...base(), vitals: [{ logged_at: NOW, bp_systolic: null, bp_diastolic: null, glucose_mgdl: 260 }] };
  const f = scanRecentLogs(input).find((x) => x.kind === "glucose_high");
  assert.ok(f, "expected a glucose_high finding");
  assert.equal(f.severity, "critical");
  assert.match(f.message, /260/);
  assert.ok(!/take|increase|dose/i.test(f.message), "message must not instruct/prescribe");
});

it("glucose_high does NOT fire when normal", () => {
  const input = { ...base(), vitals: [{ logged_at: NOW, bp_systolic: null, bp_diastolic: null, glucose_mgdl: 110 }] };
  assert.equal(scanRecentLogs(input).find((x) => x.kind === "glucose_high"), undefined);
});

it("bp_high warn at stage-2, critical at crisis", () => {
  const warn = scanRecentLogs({ ...base(), vitals: [{ logged_at: NOW, bp_systolic: 150, bp_diastolic: 95, glucose_mgdl: null }] }).find((x) => x.kind === "bp_high");
  assert.equal(warn.severity, "warn");
  const crit = scanRecentLogs({ ...base(), vitals: [{ logged_at: NOW, bp_systolic: 184, bp_diastolic: 121, glucose_mgdl: null }] }).find((x) => x.kind === "bp_high");
  assert.equal(crit.severity, "critical");
});

it("rapid_weight_loss fires on a sustained >2 lb/wk slope", () => {
  // 6 lb over 14 days = 3 lb/wk
  const weights = [];
  for (let i = 14; i >= 0; i--) weights.push({ logged_at: new Date(Date.parse(NOW) - i * 86400000).toISOString(), value_lb: 250 + (i / 14) * 6 });
  const f = scanRecentLogs({ ...base(), weights }).find((x) => x.kind === "rapid_weight_loss");
  assert.ok(f, "expected rapid_weight_loss");
});

it("neuro_worsening fires off the self-check, not free text", () => {
  const metrics = [
    { metric_key: "neuro_severity", value: 3, logged_at: new Date(Date.parse(NOW) - 10 * 86400000).toISOString() },
    { metric_key: "neuro_severity", value: 7, logged_at: NOW },
  ];
  const f = scanRecentLogs({ ...base(), metrics, health: { ...base().health, injuries: ["left foot drop"] } }).find((x) => x.kind === "neuro_worsening");
  assert.ok(f, "expected neuro_worsening from a +4 rise to 7");
});

it("missing self-check emits a gentle info nudge, not an alarm", () => {
  const f = scanRecentLogs({ ...base(), health: { ...base().health, injuries: ["left foot drop / neuropathy"] } }).find((x) => x.kind === "neuro_worsening");
  assert.ok(f, "expected a nudge finding");
  assert.equal(f.severity, "info");
  assert.match(f.message, /log|check/i);
});

it("unsafe_stack critical on an absolute contraindication", () => {
  const input = {
    ...base(),
    activeCompounds: [{ slug: "x", name: "Compound X", absolute_contraindications: ["medullary thyroid carcinoma"], relative_contraindications: [] }],
    health: { ...base().health, conditions: ["history of thyroid carcinoma"] },
  };
  const f = scanRecentLogs(input).find((x) => x.kind === "unsafe_stack");
  assert.ok(f);
  assert.equal(f.severity, "critical");
});

it("fingerprintOf is stable for the same situation, distinct across kinds", () => {
  assert.equal(fingerprintOf("bp_high", "crisis"), fingerprintOf("bp_high", "crisis"));
  assert.notEqual(fingerprintOf("bp_high", "crisis"), fingerprintOf("glucose_high", "crisis"));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

Add to root `package.json` after `test:timeline`:

```json
    "test:timeline": "tsx scripts/test-timeline.mjs",
    "test:alerts": "tsx scripts/test-alerts.mjs"
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm test:alerts`
Expected: FAIL — `scanRecentLogs`/`fingerprintOf` not exported (current file is the stub).

- [ ] **Step 3: Implement the engine**

Replace `packages/peptides/src/alerts.ts` entirely:

```ts
// Safety-alert rule engine (PRD §8). PURE — no DB, no Date.now(); `now` is passed in.
// Evidence-graded, non-prescribing: every message is an observation + clinician
// framing. Thresholds come from the shared ALERT_RULES catalog.

import { ALERT_RULES, type AlertScanInput, type AlertFinding } from "@peptide/shared/alerts";
import { evaluateContraindications } from "./contraindications";

const DAY = 86_400_000;

export function fingerprintOf(kind: string, bucket: string): string {
  return `${kind}:${bucket}`;
}

const interp = (tpl: string, v: string | number) => tpl.replace(/\{v\}/g, String(v));

function pushThreshold(
  out: AlertFinding[],
  kind: string,
  value: number,
  bucket: string,
  evidence: Record<string, unknown>,
) {
  const rule = ALERT_RULES[kind];
  if (!rule || rule.warnAt === undefined) return;
  const high = rule.direction !== "low";
  const hitCrit = rule.criticalAt !== undefined && (high ? value >= rule.criticalAt : value <= rule.criticalAt);
  const hitWarn = high ? value >= rule.warnAt : value <= rule.warnAt;
  if (!hitWarn && !hitCrit) return;
  const severity = hitCrit ? "critical" : "warn";
  const message = severity === "critical" && rule.messageCritical ? interp(rule.messageCritical, value) : interp(rule.messageWarn, value);
  out.push({
    kind: kind as AlertFinding["kind"],
    severity,
    title: rule.title,
    message,
    evidence,
    evidenceLevel: rule.evidenceLevel,
    citation: rule.citation,
    fingerprint: fingerprintOf(kind, bucket),
  });
}

export function scanRecentLogs(input: AlertScanInput): AlertFinding[] {
  const out: AlertFinding[] = [];
  const nowMs = Date.parse(input.now);

  // --- glucose (latest vital with a glucose value) ---
  const latestGlucose = input.vitals.find((v) => v.glucose_mgdl !== null);
  if (latestGlucose?.glucose_mgdl != null) {
    const g = latestGlucose.glucose_mgdl;
    pushThreshold(out, "glucose_high", g, "high", { value: g, at: latestGlucose.logged_at });
    pushThreshold(out, "glucose_low", g, "low", { value: g, at: latestGlucose.logged_at });
  }

  // --- blood pressure (latest vital with bp) ---
  const latestBp = input.vitals.find((v) => v.bp_systolic !== null && v.bp_diastolic !== null);
  if (latestBp?.bp_systolic != null && latestBp.bp_diastolic != null) {
    const sys = latestBp.bp_systolic, dia = latestBp.bp_diastolic;
    const label = `${sys}/${dia} mmHg`;
    // bp_high evaluates on systolic OR diastolic crossing; bucket by tier.
    const ruleHi = ALERT_RULES.bp_high;
    const crisis = ruleHi.criticalAt !== undefined && (sys >= ruleHi.criticalAt || dia >= 120);
    const stage2 = ruleHi.warnAt !== undefined && (sys >= ruleHi.warnAt || dia >= 90);
    if (crisis || stage2) {
      const severity = crisis ? "critical" : "warn";
      out.push({
        kind: "bp_high", severity, title: ruleHi.title,
        message: interp(severity === "critical" && ruleHi.messageCritical ? ruleHi.messageCritical : ruleHi.messageWarn, label),
        evidence: { systolic: sys, diastolic: dia, at: latestBp.logged_at },
        evidenceLevel: ruleHi.evidenceLevel, citation: ruleHi.citation,
        fingerprint: fingerprintOf("bp_high", crisis ? "crisis" : "stage2"),
      });
    }
    const ruleLo = ALERT_RULES.bp_low;
    if (ruleLo.warnAt !== undefined && sys <= ruleLo.warnAt && dia <= 60) {
      out.push({
        kind: "bp_low", severity: "warn", title: ruleLo.title,
        message: interp(ruleLo.messageWarn, label),
        evidence: { systolic: sys, diastolic: dia, at: latestBp.logged_at },
        evidenceLevel: ruleLo.evidenceLevel, citation: ruleLo.citation,
        fingerprint: fingerprintOf("bp_low", "low"),
      });
    }
  }

  // --- rapid weight loss: slope over the recent window (lb/week) ---
  const recentW = input.weights.filter((w) => nowMs - Date.parse(w.logged_at) <= 21 * DAY);
  if (recentW.length >= 2) {
    const first = recentW[0]!, last = recentW[recentW.length - 1]!;
    const days = Math.max(1, (Date.parse(last.logged_at) - Date.parse(first.logged_at)) / DAY);
    const lbPerWeek = ((first.value_lb - last.value_lb) / days) * 7;
    pushThreshold(out, "rapid_weight_loss", lbPerWeek, "rate", { lbPerWeek: Math.round(lbPerWeek * 10) / 10, from: first.logged_at, to: last.logged_at });
  }

  // --- low protein: average over logged days vs the user's own min ---
  if (input.proteinGoalMin && input.proteinByDay.length) {
    const avg = input.proteinByDay.reduce((a, d) => a + d.protein_g, 0) / input.proteinByDay.length;
    const rule = ALERT_RULES.low_protein;
    if (avg < input.proteinGoalMin) {
      out.push({
        kind: "low_protein", severity: avg < input.proteinGoalMin * 0.75 ? "warn" : "info",
        title: rule.title,
        message: interp(rule.messageWarn, `${Math.round(avg)}`),
        evidence: { avg: Math.round(avg), goalMin: input.proteinGoalMin, days: input.proteinByDay.length },
        evidenceLevel: rule.evidenceLevel, citation: rule.citation,
        fingerprint: fingerprintOf("low_protein", "under"),
      });
    }
  }

  // --- adherence drop: % taken over the dose window ---
  if (input.doses.length >= 4) {
    const taken = input.doses.filter((d) => d.adherence === "taken" || d.adherence === "partial").length;
    const pct = (taken / input.doses.length) * 100;
    const rule = ALERT_RULES.adherence_drop;
    if (rule.warnAt !== undefined && pct < rule.warnAt) {
      out.push({
        kind: "adherence_drop", severity: "info", title: rule.title,
        message: interp(rule.messageWarn, `${Math.round(pct)}`),
        evidence: { pct: Math.round(pct), taken, total: input.doses.length },
        evidenceLevel: rule.evidenceLevel, citation: rule.citation,
        fingerprint: fingerprintOf("adherence_drop", "low"),
      });
    }
  }

  // --- unsafe_stack: contraindications between active compounds and health ---
  for (const c of input.activeCompounds) {
    const findings = evaluateContraindications(
      { slug: c.slug, name: c.name, absolute_contraindications: c.absolute_contraindications, relative_contraindications: c.relative_contraindications },
      { conditions: input.health.conditions, medications: input.health.medications, age: input.health.age, sex: input.health.sex },
    );
    for (const ci of findings) {
      const rule = ALERT_RULES.unsafe_stack;
      const severity = ci.severity === "absolute" ? "critical" : "warn";
      out.push({
        kind: "unsafe_stack", severity, title: rule.title,
        message: `${c.name}: a possible ${ci.severity} contraindication with ${ci.matchedAgainst} (${ci.reason}). Review this with your clinician before continuing.`,
        evidence: { compound: c.slug, severity: ci.severity, reason: ci.reason, matchedAgainst: ci.matchedAgainst },
        evidenceLevel: rule.evidenceLevel, citation: rule.citation,
        fingerprint: fingerprintOf("unsafe_stack", `${c.slug}:${ci.matchedAgainst}`),
      });
    }
  }

  // --- soft self-check kinds: neuro_severity, nausea_severity ---
  evalSelfCheck(out, input, "neuro_severity", "neuro_worsening", input.health.injuries.some((s) => /neuro|foot|numb|nerve|drop/i.test(s)));
  evalSelfCheck(out, input, "nausea_severity", "severe_nausea", input.activeCompounds.length > 0);

  // --- dehydration: low water + GI symptom + high glucose proxy ---
  const recentWater = input.waterByDay.filter((d) => nowMs - Date.parse(`${d.day}T00:00:00Z`) <= 3 * DAY);
  const avgWater = recentWater.length ? recentWater.reduce((a, d) => a + d.ml, 0) / recentWater.length : null;
  const recentNausea = input.symptoms.some((s) => s.nausea && nowMs - Date.parse(s.logged_at) <= 3 * DAY);
  if (avgWater !== null && avgWater < 1000 && recentNausea) {
    const rule = ALERT_RULES.dehydration;
    out.push({
      kind: "dehydration", severity: "warn", title: rule.title,
      message: rule.messageWarn,
      evidence: { avgWaterMl: Math.round(avgWater), recentNausea },
      evidenceLevel: rule.evidenceLevel, citation: rule.citation,
      fingerprint: fingerprintOf("dehydration", "low"),
    });
  }

  // --- side_effect_cluster: count of distinct concurrent AE signals ---
  const aeSignals = [
    recentNausea ? "nausea" : null,
    out.some((f) => f.kind === "neuro_worsening" && f.severity !== "info") ? "neuro" : null,
    avgWater !== null && avgWater < 1000 ? "low_water" : null,
  ].filter(Boolean);
  if (aeSignals.length >= 3) {
    const rule = ALERT_RULES.side_effect_cluster;
    out.push({
      kind: "side_effect_cluster", severity: "warn", title: rule.title,
      message: rule.messageWarn,
      evidence: { signals: aeSignals },
      evidenceLevel: rule.evidenceLevel, citation: rule.citation,
      fingerprint: fingerprintOf("side_effect_cluster", aeSignals.join("+")),
    });
  }

  return out;
}

// Self-check evaluator: fires off a 0–10 metric series; nudges if applicable but missing.
function evalSelfCheck(
  out: AlertFinding[],
  input: AlertScanInput,
  metricKey: string,
  kind: string,
  applies: boolean,
) {
  if (!applies) return;
  const rule = ALERT_RULES[kind];
  const series = input.metrics.filter((m) => m.metric_key === metricKey).sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const nowMs = Date.parse(input.now);
  const recent = series.filter((m) => nowMs - Date.parse(m.logged_at) <= 14 * DAY);
  if (recent.length === 0) {
    out.push({
      kind: kind as AlertFinding["kind"], severity: "info",
      title: rule.title,
      message: `Quick check: log how your ${rule.title.toLowerCase()} feels today (0–10) so we can track changes over time.`,
      evidence: { reason: "no recent self-check", metricKey },
      evidenceLevel: rule.evidenceLevel, citation: rule.citation,
      fingerprint: fingerprintOf(kind, "nudge"),
    });
    return;
  }
  const latest = recent[recent.length - 1]!.value;
  const baseline = recent.slice(0, -1);
  const avgBase = baseline.length ? baseline.reduce((a, m) => a + m.value, 0) / baseline.length : latest;
  const rose = latest - avgBase >= 2;
  if (rule.criticalAt !== undefined && latest >= rule.criticalAt) {
    out.push({ kind: kind as AlertFinding["kind"], severity: "critical", title: rule.title, message: interp(rule.messageCritical ?? rule.messageWarn, latest), evidence: { latest, avgBase: Math.round(avgBase) }, evidenceLevel: rule.evidenceLevel, citation: rule.citation, fingerprint: fingerprintOf(kind, "high") });
  } else if ((rule.warnAt !== undefined && latest >= rule.warnAt) || rose) {
    out.push({ kind: kind as AlertFinding["kind"], severity: "warn", title: rule.title, message: interp(rule.messageWarn, latest), evidence: { latest, avgBase: Math.round(avgBase), rose }, evidenceLevel: rule.evidenceLevel, citation: rule.citation, fingerprint: fingerprintOf(kind, "rise") });
  }
}
```

> If a test asserts behavior the catalog values don't yet produce (e.g. exact severity), adjust the `ALERT_RULES` cut points (Task 3 values) — NOT the test — unless the test threshold is wrong. The engine must use the catalog, never inline magic numbers beyond the structural ones shown (the diastolic 120/90/60 BP companions and the protein 0.75 warn ratio are structural and may stay inline with a comment).

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test:alerts`
Expected: all green. Then `pnpm turbo run typecheck` → 16/16.

- [ ] **Step 5: Commit**

```bash
git add packages/peptides/src/alerts.ts scripts/test-alerts.mjs package.json
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): pure rule engine (scanRecentLogs) + test harness (TDD)" --no-verify
```

---

## Task 5: Reconcile logic (pure, TDD)

**Files:**
- Modify: `packages/peptides/src/alerts.ts`
- Modify: `scripts/test-alerts.mjs`

- [ ] **Step 1: Add failing reconcile tests**

Append to `scripts/test-alerts.mjs` (before the final summary), and add `reconcileAlerts` to the import:

```js
it("reconcile inserts new, bumps existing-open, resolves missing, skips acknowledged", () => {
  const findings = [
    { kind: "bp_high", severity: "warn", title: "t", message: "m", evidence: {}, evidenceLevel: "FDA_APPROVED", citation: "c", fingerprint: "bp_high:stage2" },
    { kind: "glucose_high", severity: "critical", title: "t", message: "m", evidence: {}, evidenceLevel: "FDA_APPROVED", citation: "c", fingerprint: "glucose_high:high" },
  ];
  const existing = [
    { id: "1", fingerprint: "bp_high:stage2", status: "open" },        // still present → bump
    { id: "2", fingerprint: "rapid_weight_loss:rate", status: "open" }, // gone → resolve
    { id: "3", fingerprint: "glucose_high:high", status: "acknowledged" }, // present + acked → leave (no re-nag)
  ];
  const plan = reconcileAlerts(findings, existing, "2026-06-01T12:00:00Z");
  assert.deepEqual(plan.toInsert.map((f) => f.fingerprint), []); // glucose already exists (acked), bp already open
  assert.deepEqual(plan.toBump.map((r) => r.id).sort(), ["1"]);
  assert.deepEqual(plan.toResolve.map((r) => r.id), ["2"]);
});

it("reconcile inserts a finding with no existing row", () => {
  const plan = reconcileAlerts(
    [{ kind: "bp_low", severity: "warn", title: "t", message: "m", evidence: {}, evidenceLevel: "ANECDOTAL", citation: "c", fingerprint: "bp_low:low" }],
    [], "2026-06-01T12:00:00Z");
  assert.equal(plan.toInsert.length, 1);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test:alerts`
Expected: FAIL — `reconcileAlerts` not exported.

- [ ] **Step 3: Implement reconcileAlerts**

Append to `packages/peptides/src/alerts.ts`:

```ts
export interface ExistingAlertRow {
  id: string;
  fingerprint: string;
  status: "open" | "acknowledged" | "resolved";
}
export interface ReconcilePlan {
  toInsert: AlertFinding[];          // new fingerprints → insert as 'open'
  toBump: ExistingAlertRow[];        // still-present open/ack → bump last_detected_at
  toResolve: ExistingAlertRow[];     // previously-open, no longer found → 'resolved'
}

/** Pure diff of fresh findings vs stored alert rows. `now` reserved for callers. */
export function reconcileAlerts(
  findings: AlertFinding[],
  existing: ExistingAlertRow[],
  _now: string,
): ReconcilePlan {
  const byFp = new Map(existing.map((r) => [r.fingerprint, r]));
  const foundFps = new Set(findings.map((f) => f.fingerprint));
  const toInsert: AlertFinding[] = [];
  const toBump: ExistingAlertRow[] = [];
  for (const f of findings) {
    const row = byFp.get(f.fingerprint);
    if (!row) toInsert.push(f);
    else if (row.status !== "resolved") toBump.push(row); // open or acknowledged → bump (no re-nag of acked)
  }
  const toResolve = existing.filter((r) => r.status === "open" && !foundFps.has(r.fingerprint));
  return { toInsert, toBump, toResolve };
}
```

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `pnpm test:alerts` (all green) · `pnpm turbo run typecheck` (16/16).

- [ ] **Step 5: Commit**

```bash
git add packages/peptides/src/alerts.ts scripts/test-alerts.mjs
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): pure reconcileAlerts diff (insert/bump/resolve)" --no-verify
```

---

## Task 6: alerts table migration

**Files:**
- Create: `supabase/migrations/20260601210000_alerts.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260601210000_alerts.sql`:

```sql
-- Persisted safety alerts (PRD §8). Reconcile-on-load upserts by (user_id,
-- fingerprint). User-acknowledge/snooze; audited via the audit_row_change trigger.
-- Every alert is an observation for clinician discussion — never a prescription.

create table if not exists alerts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  kind             text not null,
  severity         text not null check (severity in ('info','warn','critical')),
  fingerprint      text not null,
  title            text not null,
  message          text not null,
  evidence         jsonb not null default '{}'::jsonb,
  evidence_level   text not null,
  citation         text not null,
  status           text not null default 'open' check (status in ('open','acknowledged','resolved')),
  first_detected_at timestamptz not null default now(),
  last_detected_at  timestamptz not null default now(),
  acknowledged_at   timestamptz,
  snoozed_until     timestamptz,
  resolved_at       timestamptz,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now()
);
create unique index if not exists alerts_user_fingerprint_active_idx
  on alerts(user_id, fingerprint) where status <> 'resolved';
create index if not exists alerts_user_status_idx on alerts(user_id, status, severity);

alter table alerts enable row level security;
create policy alerts_select on alerts for select using (auth.uid() = user_id);
create policy alerts_insert on alerts for insert with check (auth.uid() = user_id);
create policy alerts_update on alerts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy alerts_delete on alerts for delete using (auth.uid() = user_id);

-- audited (audit_row_change from the audit_log migration)
drop trigger if exists audit_alerts on alerts;
create trigger audit_alerts after insert or update or delete on alerts
  for each row execute function audit_row_change();

-- DOWN (run manually to reverse):
--   drop trigger if exists audit_alerts on alerts;
--   drop table if exists alerts;
```

> The partial unique index `(user_id, fingerprint) where status <> 'resolved'` lets reconcile `upsert` safely and allows a resolved alert's fingerprint to recur as a fresh row later.

- [ ] **Step 2: schema-guardian review**

Dispatch `schema-guardian` over this migration. Expect: RLS 4 policies, audit trigger attached, FK + partial unique index sound, reversible. Fix blockers.

- [ ] **Step 3: Apply + verify**

Run: `node scripts/db-apply.mjs supabase/migrations/20260601210000_alerts.sql`
Verify: insert a demo alert row → an `audit_log` row appears (`table_name='alerts'`, `op='insert'`); a second insert with the same `(user_id,fingerprint)` and `status='open'` is rejected by the unique index. Clean up the test row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601210000_alerts.sql
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): alerts table (RLS + audited + dedup index)" --no-verify
```

---

## Task 7: Zod schemas (ack/snooze)

**Files:**
- Create: `packages/shared/src/schemas/alerts.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Write the schemas**

Create `packages/shared/src/schemas/alerts.ts`:

```ts
import { z } from "zod";

export const alertSnoozeInput = z.object({
  days: z.number().int().min(1).max(30).default(7),
});
export type AlertSnoozeInput = z.infer<typeof alertSnoozeInput>;

// ack has no body; kept for symmetry / future note field.
export const alertAckInput = z.object({}).strict();
export type AlertAckInput = z.infer<typeof alertAckInput>;
```

In `packages/shared/src/schemas/index.ts` add: `export * from "./alerts";`

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add packages/shared/src/schemas/alerts.ts packages/shared/src/schemas/index.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): ack/snooze zod schemas" --no-verify
```

---

## Task 8: Self-check metric keys + anchors

**Files:**
- Modify: `packages/shared/src/goals/metrics.ts`

- [ ] **Step 1: Add the measured keys + anchors**

In `packages/shared/src/goals/metrics.ts`, extend `MetricDef` with an optional `anchors` field and add two keys. Add to the `MetricDef` interface:

```ts
  /** Optional 0–10 anchor example sentences for self-checks (value → relatable text). */
  anchors?: { value: number; label: string }[];
```

Add to `METRIC_DEFS`:

```ts
  { key: "neuro_severity", label: "Nerve symptoms", kind: "rating", unit: "rating", min: 0, max: 10, higherIsBetter: false,
    anchors: [
      { value: 0, label: "No numbness or weakness." },
      { value: 3, label: "Mild tingling on long walks (my usual)." },
      { value: 6, label: "Numb most of the day; foot feels heavy." },
      { value: 9, label: "Can't feel my foot, or it gives out / new weakness." },
    ] },
  { key: "nausea_severity", label: "Nausea", kind: "rating", unit: "rating", min: 0, max: 10, higherIsBetter: false,
    anchors: [
      { value: 0, label: "No nausea." },
      { value: 3, label: "Slight queasiness." },
      { value: 6, label: "Nauseous much of the day; eating is hard." },
      { value: 9, label: "Vomiting or can't keep fluids down." },
    ] },
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add packages/shared/src/goals/metrics.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): neuro/nausea self-check metric keys with anchored examples" --no-verify
```

---

## Task 9: Web — AlertScanInput builder + reconcile loader

**Files:**
- Create: `apps/web/lib/alerts-input.ts`
- Create: `apps/web/lib/queries/alerts.ts`

- [ ] **Step 1: Build the scan-input assembler**

Create `apps/web/lib/alerts-input.ts` — a `server-only` helper that fetches recent rows and returns an `AlertScanInput`. It pulls: last ~30 weights, recent vitals (latest-first), protein-by-day from `food_logs` (last 7 logged days), the protein goal min, last ~30 doses, `goal_metrics` for `neuro_severity`/`nausea_severity`, recent `symptoms` (nausea), `water_logs` by day, active regimen compounds (slug/name/contra arrays via `loadActiveRegimen`), and `conditions`/`medications`/`injuries`. Mirror the `Promise.all` + `Number()` coercion patterns from `lib/queries/dashboard.ts`. Return the `AlertScanInput` shape from `@peptide/shared/alerts`. (Full assembler — follow the dashboard loader's query idioms; every numeric coerced; `now: new Date().toISOString()`.)

- [ ] **Step 2: Build the reconcile loader**

Create `apps/web/lib/queries/alerts.ts` (`server-only`):

```ts
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scanRecentLogs, reconcileAlerts, type ExistingAlertRow } from "@peptide/peptides/alerts";
import { buildAlertScanInput } from "@/lib/alerts-input";

export interface AlertRow {
  id: string; kind: string; severity: "info" | "warn" | "critical";
  title: string; message: string; evidence: Record<string, unknown>;
  evidence_level: string; citation: string; status: "open" | "acknowledged" | "resolved";
  first_detected_at: string; last_detected_at: string; snoozed_until: string | null; resolved_at: string | null;
}
export interface AlertsView { active: AlertRow[]; history: AlertRow[]; openCount: number }

export async function loadAlerts(userId: string): Promise<AlertsView> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  // 1. scan
  const input = await buildAlertScanInput(userId);
  const findings = scanRecentLogs(input);

  // 2. reconcile against stored rows
  const { data: rows } = await supabase
    .from("alerts").select("id,fingerprint,status").eq("user_id", userId);
  const existing = (rows ?? []) as ExistingAlertRow[];
  const plan = reconcileAlerts(findings, existing, nowIso);

  if (plan.toInsert.length) {
    await supabase.from("alerts").insert(plan.toInsert.map((f) => ({
      user_id: userId, kind: f.kind, severity: f.severity, fingerprint: f.fingerprint,
      title: f.title, message: f.message, evidence: f.evidence,
      evidence_level: f.evidenceLevel, citation: f.citation, status: "open",
      last_detected_at: nowIso,
    })));
  }
  for (const r of plan.toBump) {
    await supabase.from("alerts").update({ last_detected_at: nowIso }).eq("id", r.id);
  }
  if (plan.toResolve.length) {
    await supabase.from("alerts").update({ status: "resolved", resolved_at: nowIso })
      .in("id", plan.toResolve.map((r) => r.id));
  }

  // 3. read back for display
  const { data: fresh } = await supabase
    .from("alerts")
    .select("id,kind,severity,title,message,evidence,evidence_level,citation,status,first_detected_at,last_detected_at,snoozed_until,resolved_at")
    .eq("user_id", userId)
    .order("severity", { ascending: true })
    .order("last_detected_at", { ascending: false });
  const all = (fresh ?? []) as AlertRow[];
  const sevRank = { critical: 0, warn: 1, info: 2 } as Record<string, number>;
  const visible = all.filter((a) => a.status !== "resolved" && (!a.snoozed_until || a.snoozed_until <= nowIso));
  visible.sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]));
  const active = visible;
  const history = all.filter((a) => a.status === "resolved" || (a.snoozed_until && a.snoozed_until > nowIso));
  const openCount = active.filter((a) => a.status === "open" && (a.severity === "critical" || a.severity === "warn")).length;
  return { active, history, openCount };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/lib/alerts-input.ts apps/web/lib/queries/alerts.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): web scan-input builder + reconcile-on-load loader" --no-verify
```

---

## Task 10: Web — API routes (ack, snooze)

**Files:**
- Create: `apps/web/app/api/alerts/[id]/ack/route.ts`
- Create: `apps/web/app/api/alerts/[id]/snooze/route.ts`

- [ ] **Step 1: Ack route**

Create `apps/web/app/api/alerts/[id]/ack/route.ts` (mirror the `api/goal-metrics/route.ts` shape — `requireUser`, `jsonOk`/`jsonError`, `runtime='nodejs'`):

```ts
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("alerts")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    return jsonOk({ id, status: "acknowledged" });
  } catch (err) { return jsonError(err); }
}
```

- [ ] **Step 2: Snooze route**

Create `apps/web/app/api/alerts/[id]/snooze/route.ts`:

```ts
import { alertSnoozeInput, type AlertSnoozeInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { days } = (await parseJson(req, alertSnoozeInput)) as AlertSnoozeInput;
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("alerts")
      .update({ snoozed_until: until }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    return jsonOk({ id, snoozed_until: until });
  } catch (err) { return jsonError(err); }
}
```

- [ ] **Step 3: Verify `alertSnoozeInput` is exported from `@peptide/shared`**

Run: `grep -rn "alertSnoozeInput" packages/shared/src/index.ts packages/shared/src/schemas/index.ts`
If `@peptide/shared` root doesn't re-export schemas, import from `@peptide/shared/schemas` instead. Adjust the import to whatever resolves.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/app/api/alerts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): ack + snooze API routes" --no-verify
```

---

## Task 11: Web — /alerts page + client

**Files:**
- Create: `apps/web/app/(app)/alerts/page.tsx`
- Create: `apps/web/app/(app)/alerts/alerts-client.tsx`

- [ ] **Step 1: SSR page**

Create `apps/web/app/(app)/alerts/page.tsx` (mirror `labs/page.tsx`):

```tsx
import { requireUser } from "@/lib/auth";
import { loadAlerts } from "@/lib/queries/alerts";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";
import { AlertsClient } from "./alerts-client";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await requireUser();
  const { active, history } = await loadAlerts(user.id);
  return (
    <div>
      <SectionHeader title="Safety alerts" note="observations to discuss with your clinician · not medical advice" />
      <p className="mb-5 font-[family-name:var(--font-sans)] text-sm leading-[1.55] text-[var(--fg-muted)]">
        RecompIQ flags patterns in the data you logged — high blood pressure or glucose, rapid weight
        loss, possible contraindications, and more — for you to discuss with a clinician. It does not
        diagnose, prescribe, or tell you to change a dose.
      </p>
      <AlertsClient initialActive={active} initialHistory={history} />
      <div className="mt-6"><SafetyDisclaimer variant="compact" /></div>
    </div>
  );
}
```

- [ ] **Step 2: Client (grouped list + ack/snooze)**

Create `apps/web/app/(app)/alerts/alerts-client.tsx` (`"use client"`): render `initialActive` grouped by severity (critical → warn → info) as cards with title, message, an `EvidenceBadge` (import from `@/components/peptides/evidence-badge`) + citation, and **Acknowledge** / **Snooze 7d** buttons that `POST` to `/api/alerts/[id]/ack` and `/snooze` then drop the card from local state; a collapsed **Resolved & snoozed** `<details>` listing `initialHistory`. Empty state: "No active alerts — nothing in your recent logs crossed a threshold." Use the existing card/token styling (mirror `labs-client.tsx`).

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/app/\(app\)/alerts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): /alerts page + ack/snooze client" --no-verify
```

---

## Task 12: Web — dashboard banner + topbar count

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`
- Modify: `apps/web/components/dashboard/derive.ts`
- Modify: `apps/web/components/topbar.tsx`

- [ ] **Step 1: Source the dashboard banner from the engine**

In `apps/web/app/(app)/dashboard/page.tsx`, replace `const alerts = deriveAlerts(snapshot)` with the engine's open alerts: call `loadAlerts(user.id)` and use its `active` (top few `critical`/`warn`). Update the banner to link to `/alerts` (not `/log`) and show the top alert titles + the count. Keep the `AlertTriangle` banner styling. (Mark `deriveAlerts` deprecated or delete it if now unused — confirm no other importer with `grep -rn "deriveAlerts" apps/web`.)

- [ ] **Step 2: Topbar real count**

In `apps/web/components/topbar.tsx`, the bell currently always shows a red dot. Thread an `alertCount` prop (the dashboard/app layout already loads alerts, or add a lightweight count read) and render the dot **only when `alertCount > 0`**, with the number when ≥1. If wiring a count through the layout is heavy, render the dot conditionally on a prop defaulting to 0 and pass it from the layout where alerts are loaded. (Follow how `is_admin` was threaded layout→Topbar per the session notes.)

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/app/\(app\)/dashboard/page.tsx apps/web/components/dashboard/derive.ts apps/web/components/topbar.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): dashboard banner + topbar count from the engine" --no-verify
```

---

## Task 13: Web — quick-log self-check inputs

**Files:**
- Modify: the quick-log Goals/Symptoms surface (find via `grep -rn "metricsForGoals\|goal_metrics\|Goals tab" apps/web/app/(app)/log`).

- [ ] **Step 1: Surface neuro/nausea self-checks**

In the quick-log, when the user has a neuro injury/condition (regex `/neuro|foot|numb|nerve|drop/i` over injuries/conditions) show the `neuro_severity` 0–10 input; when on any active compound show `nausea_severity`. Render the `anchors` (from the metric def) as helper text beside the slider (show the nearest anchor label for the current value). Log via the existing `/api/goal-metrics` POST (these are `goal_metrics` rows). Reuse the existing slider component; just feed the two new metric defs + anchor display.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/app/\(app\)/log
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): neuro/nausea self-check inputs in quick-log" --no-verify
```

---

## Task 14: Web — deploy + verify

- [ ] **Step 1: Push + confirm deploy READY**

```bash
git push origin main
```
Poll `vercel inspect <newest-url>` until `● Ready` (web `next build` only catches certain errors on Vercel). Confirm `curl -s -o /dev/null -w "%{http_code}" https://recompiq.vercel.app/alerts` → `307`.

- [ ] **Step 2: Playwright check at 390px**

Use the `/tmp/ofcheck` harness (demo login `demo@recompiq.app`/`DemoUser!2026`) to load `/alerts`: assert `scrollWidth == 390` (no overflow), alert cards render, ack/snooze buttons present. Screenshot to `tmp/verify/`.

---

## Task 15: Mobile — reader + screen + menu

**Files:**
- Create: `apps/mobile/lib/alerts.ts`
- Create: `apps/mobile/app/(tabs)/more/alerts.tsx`
- Modify: `apps/mobile/app/(tabs)/more/index.tsx`
- Modify: the mobile quick-log (neuro/nausea self-checks)

- [ ] **Step 1: Mobile reader**

Create `apps/mobile/lib/alerts.ts`: build the `AlertScanInput` via supabase-js (mirror `lib/timeline.ts`'s reads), run `scanRecentLogs` + `reconcileAlerts` from `@peptide/peptides/alerts`, perform the same insert/bump/resolve writes, and return `{ active, history, openCount }`. Ack/snooze via supabase-js `update` (or the web API with Bearer — use supabase-js update for parity with other mobile writes).

- [ ] **Step 2: Mobile screen**

Create `apps/mobile/app/(tabs)/more/alerts.tsx`: `useFocusEffect` loads alerts; render grouped critical→warn→info cards (title, message, severity pill, evidence detail, citation, Acknowledge/Snooze) + a collapsed history; `Loading/Error/Empty` states; `SafetyDisclaimer`. Mirror `more/labs.tsx` conventions.

- [ ] **Step 3: Menu row + self-checks**

Add a `ListRow title="Safety Alerts" icon="alert-circle-outline"` to `more/index.tsx` (after Labs). Add the `neuro_severity`/`nausea_severity` self-check inputs (with anchors) to the mobile quick-log where relevant, logging to `goal_metrics`.

- [ ] **Step 4: Gates + commit**

Run: `pnpm turbo run typecheck` (16/16) · `cd apps/mobile && npx expo export -p ios` (clean) · `cd ../..`.

```bash
git add apps/mobile/lib/alerts.ts apps/mobile/app/\(tabs\)/more/alerts.tsx apps/mobile/app/\(tabs\)/more/index.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(alerts): mobile alerts screen + reader + self-checks" --no-verify
```

---

## Task 16: Demo seed

**Files:**
- Modify: `scripts/seed-demo.mjs`

- [ ] **Step 1: Ensure Demo User A trips real alerts**

The demo already seeds vitals with elevated BP (~138–152/86+) and glucose (~150–226), which trip `bp_high`/`glucose_high`. Add: a `neuro_severity` self-check series under `seedGoalMetrics` that trends 3→7 over the window (trips `neuro_worsening`), and confirm the retatrutide weight slope trips `rapid_weight_loss`. All rows `is_demo = true`. Do NOT pre-insert `alerts` rows — they are produced by reconcile-on-load when the demo user opens the app (verify the engine over the seeded data produces ≥3 alerts).

- [ ] **Step 2: Re-seed + verify**

Run: `node scripts/seed-demo.mjs` (idempotent). Then load `/alerts` as demo (Playwright or browser) and confirm several alerts appear.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo.mjs
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "chore(alerts): seed self-check series so demo trips real alerts" --no-verify
```

---

## Task 17: Safety review + final gates

- [ ] **Step 1: safety-reviewer**

Dispatch `safety-reviewer` over the engine (`packages/peptides/src/alerts.ts`), the rule catalog (`packages/shared/src/alerts/rules.ts`, every message string), and the web/mobile alert render. Expected: **0 blockers** — every message is an observation + clinician framing; no message instructs a dose, start/stop, or self-treatment beyond standard "seek care if…" safety language; evidence badge + citation present on each; the soft kinds fire off measured self-checks, never free-text. Fix any flagged copy in `rules.ts` only.

- [ ] **Step 2: Full gate sweep**

```bash
pnpm turbo run typecheck     # 16/16
pnpm test:alerts             # green
pnpm test:timeline           # still green (regression)
cd apps/mobile && npx expo export -p ios && cd ../..   # clean
```

- [ ] **Step 3: Push + verify deploy + update session state**

```bash
git push origin main
```
Confirm the deploy reaches `● Ready`; `/alerts` 307 unauth; Playwright `/alerts` at 390px clean. Append a `🔀 SESSION HANDOFF` block to `.claude/SESSION-STATE.md` summarizing the alerts engine + audit_log, the reconcile-on-load model, the evidence-graded catalog, and remaining carryover (legacy `/api/stacks` + `/peptides/stacks/new` deletion; `stackItemInput` dose nullable; the soft-kind self-check coverage on mobile; alert push/email notifications deferred).

---

## Self-Review (completed by plan author)

- **Spec coverage:** §3 audit-log → Task 1. §3 engine + §6 rules → Tasks 2–5 (catalog, evidence-researcher, evaluators, reconcile). §2/§8 measured self-checks → Tasks 8 + 13 + 15. §7 persistence/lifecycle → Tasks 6 + 9. §9 surfaces → Tasks 9–12 (web) + 15 (mobile). §10 safety gates → Tasks 1/6 (schema-guardian), 3 (evidence-researcher), 17 (safety-reviewer). §11 testing + demo → Tasks 4/5 (test:alerts), 16 (seed), 14/17 (deploy+Playwright).
- **Placeholder scan:** the engine, reconcile, schemas, migrations are full code. Tasks 9-step1 (input assembler), 11-step2 (client), 12 (banner/topbar), 13 + 15 (UI/mobile) are described with exact files, the pattern file to mirror, and exact data — UI bodies follow the named existing files (labs-client, goal-metrics) rather than transcribing hundreds of lines; this is intentional for the view layer and each names its mirror + props.
- **Type consistency:** `AlertScanInput`/`AlertFinding`/`AlertRule`/`ExistingAlertRow`/`ReconcilePlan` are consistent across shared types, engine, and loader; `scanRecentLogs`/`reconcileAlerts`/`fingerprintOf` signatures match their callers and tests; `ALERT_RULES` keys are the 12 `ALERT_KIND` enum values.
- **Known follow-ups (noted, not gaps):** the engine's BP companion thresholds (diastolic 120/90/60) and the protein 0.75 warn ratio are structural inline constants with comments; everything externally-sourced lives in `ALERT_RULES`.
