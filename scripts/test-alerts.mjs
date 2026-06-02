#!/usr/bin/env node
// Test harness for the safety-alert engine. Runs via `pnpm test:alerts`.
import assert from "node:assert/strict";
import { scanRecentLogs, fingerprintOf, reconcileAlerts, selectAlertsToNotify } from "../packages/peptides/src/alerts.ts";

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
  // catalog: warnAt 250 / criticalAt 300 → 310 is critical
  const input = { ...base(), vitals: [{ logged_at: NOW, bp_systolic: null, bp_diastolic: null, glucose_mgdl: 310 }] };
  const f = scanRecentLogs(input).find((x) => x.kind === "glucose_high");
  assert.ok(f, "expected a glucose_high finding");
  assert.equal(f.severity, "critical");
  assert.match(f.message, /310/);
  assert.ok(!/take|increase|dose/i.test(f.message), "message must not instruct/prescribe");
});

it("glucose_high warns between warn and critical cut", () => {
  // catalog: 260 is between warnAt 250 and criticalAt 300 → warn
  const input = { ...base(), vitals: [{ logged_at: NOW, bp_systolic: null, bp_diastolic: null, glucose_mgdl: 260 }] };
  const f = scanRecentLogs(input).find((x) => x.kind === "glucose_high");
  assert.ok(f, "expected a glucose_high finding");
  assert.equal(f.severity, "warn");
});

it("glucose_high does NOT fire when normal", () => {
  // catalog: warnAt 250 → 110 is well below, no fire
  const input = { ...base(), vitals: [{ logged_at: NOW, bp_systolic: null, bp_diastolic: null, glucose_mgdl: 110 }] };
  assert.equal(scanRecentLogs(input).find((x) => x.kind === "glucose_high"), undefined);
});

it("bp_high warn at stage-2, critical at crisis", () => {
  const warn = scanRecentLogs({ ...base(), vitals: [{ logged_at: NOW, bp_systolic: 150, bp_diastolic: 95, glucose_mgdl: null }] }).find((x) => x.kind === "bp_high");
  assert.equal(warn.severity, "warn");
  const crit = scanRecentLogs({ ...base(), vitals: [{ logged_at: NOW, bp_systolic: 184, bp_diastolic: 121, glucose_mgdl: null }] }).find((x) => x.kind === "bp_high");
  assert.equal(crit.severity, "critical");
});

it("bp_low warns on the low side, escalates to critical at the crisis cut", () => {
  // catalog: warnAt 90 / criticalAt 80; companion diastolic ≤ 60
  const crit = scanRecentLogs({ ...base(), vitals: [{ logged_at: NOW, bp_systolic: 72, bp_diastolic: 50, glucose_mgdl: null }] }).find((x) => x.kind === "bp_low");
  assert.ok(crit, "expected a bp_low finding");
  assert.equal(crit.severity, "critical");
  const warn = scanRecentLogs({ ...base(), vitals: [{ logged_at: NOW, bp_systolic: 88, bp_diastolic: 58, glucose_mgdl: null }] }).find((x) => x.kind === "bp_low");
  assert.equal(warn.severity, "warn");
});

it("adherence_drop is two-tier: warn below the critical cut, info between", () => {
  // catalog: warnAt 80 / criticalAt 60
  const taken = (pct, n = 8) => Array.from({ length: n }, (_, i) => ({ taken_at: NOW, adherence: i < Math.round((pct / 100) * n) ? "taken" : "missed" }));
  const warn = scanRecentLogs({ ...base(), doses: taken(50) }).find((x) => x.kind === "adherence_drop"); // 50% < 60
  assert.ok(warn, "expected an adherence_drop finding");
  assert.equal(warn.severity, "warn");
  const info = scanRecentLogs({ ...base(), doses: taken(75) }).find((x) => x.kind === "adherence_drop"); // 60 ≤ 75 < 80
  assert.equal(info.severity, "info");
});

it("rapid_weight_loss fires on a sustained >2 lb/wk slope", () => {
  // 6 lb over 14 days = 3 lb/wk; catalog warnAt 2 / criticalAt 3
  const weights = [];
  for (let i = 14; i >= 0; i--) weights.push({ logged_at: new Date(Date.parse(NOW) - i * 86400000).toISOString(), value_lb: 250 + (i / 14) * 6 });
  const f = scanRecentLogs({ ...base(), weights }).find((x) => x.kind === "rapid_weight_loss");
  assert.ok(f, "expected rapid_weight_loss");
});

it("neuro_worsening fires off the self-check, not free text", () => {
  // catalog warnAt 6 → a rise to 7 (>= 6) warns
  const metrics = [
    { metric_key: "neuro_severity", value: 3, logged_at: new Date(Date.parse(NOW) - 10 * 86400000).toISOString() },
    { metric_key: "neuro_severity", value: 7, logged_at: NOW },
  ];
  const f = scanRecentLogs({ ...base(), metrics, health: { ...base().health, injuries: ["left foot drop"] } }).find((x) => x.kind === "neuro_worsening");
  assert.ok(f, "expected neuro_worsening from a rise to 7");
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
  assert.deepEqual(plan.toBump.map((r) => r.id).sort(), ["1", "3"]);
  assert.deepEqual(plan.toResolve.map((r) => r.id), ["2"]);
});

it("reconcile inserts a finding with no existing row", () => {
  const plan = reconcileAlerts(
    [{ kind: "bp_low", severity: "warn", title: "t", message: "m", evidence: {}, evidenceLevel: "ANECDOTAL", citation: "c", fingerprint: "bp_low:low" }],
    [], "2026-06-01T12:00:00Z");
  assert.equal(plan.toInsert.length, 1);
});

const A = (severity, notified_at = null, status = "open") => ({
  id: severity + (notified_at ?? ""), severity, status, notified_at,
  title: "t", message: "m", kind: "bp_high", evidence_level: "FDA_APPROVED", citation: "c",
});

it("selectAlertsToNotify: disabled when toggle off or channel off/in_app", () => {
  const alerts = [A("critical")];
  assert.equal(selectAlertsToNotify(alerts, { mode: "immediate", channel: "both", enabled: false }).toSend.length, 0);
  assert.equal(selectAlertsToNotify(alerts, { mode: "immediate", channel: "off", enabled: true }).toSend.length, 0);
  assert.equal(selectAlertsToNotify(alerts, { mode: "immediate", channel: "in_app", enabled: true }).toSend.length, 0);
});

it("selectAlertsToNotify: immediate = critical only; digest = critical+warn; never info", () => {
  const alerts = [A("critical"), A("warn"), A("info")];
  const imm = selectAlertsToNotify(alerts, { mode: "immediate", channel: "email", enabled: true });
  assert.deepEqual(imm.toSend.map((a) => a.severity), ["critical"]);
  const dig = selectAlertsToNotify(alerts, { mode: "digest", channel: "email", enabled: true });
  assert.deepEqual(dig.toSend.map((a) => a.severity).sort(), ["critical", "warn"]);
});

it("selectAlertsToNotify: skips already-notified and non-open", () => {
  const alerts = [A("critical", "2026-06-01T00:00:00Z"), A("warn", null, "acknowledged")];
  assert.equal(selectAlertsToNotify(alerts, { mode: "digest", channel: "both", enabled: true }).toSend.length, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
