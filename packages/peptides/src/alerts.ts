// Safety-alert rule engine (PRD §8). PURE — no DB, no Date.now(); `now` is passed in.
// Evidence-graded, non-prescribing: every message is an observation + clinician
// framing. Thresholds come from the shared ALERT_RULES catalog.

import { ALERT_RULES, type AlertRule, type AlertScanInput, type AlertFinding } from "@peptide/shared/alerts";
import { evaluateContraindications } from "./contraindications";

const DAY = 86_400_000;

// Typed accessor: the catalog is exhaustive over the kinds the engine reads, so a
// hit is guaranteed at runtime. This narrows away the index-signature `undefined`
// that `noUncheckedIndexedAccess` adds, without scattering `!` through the engine.
function ruleFor(kind: string): AlertRule {
  const rule = ALERT_RULES[kind];
  if (!rule) throw new Error(`missing ALERT_RULES entry: ${kind}`);
  return rule;
}

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
    const ruleHi = ruleFor("bp_high");
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
    const ruleLo = ruleFor("bp_low");
    // bp_low two-tier: systolic must cross AND diastolic ≤ 60 (companion).
    const loCrisis = ruleLo.criticalAt !== undefined && sys <= ruleLo.criticalAt && dia <= 60;
    const loWarn = ruleLo.warnAt !== undefined && sys <= ruleLo.warnAt && dia <= 60;
    if (loCrisis || loWarn) {
      const severity = loCrisis ? "critical" : "warn";
      out.push({
        kind: "bp_low", severity, title: ruleLo.title,
        message: interp(severity === "critical" && ruleLo.messageCritical ? ruleLo.messageCritical : ruleLo.messageWarn, label),
        evidence: { systolic: sys, diastolic: dia, at: latestBp.logged_at },
        evidenceLevel: ruleLo.evidenceLevel, citation: ruleLo.citation,
        fingerprint: fingerprintOf("bp_low", loCrisis ? "crisis" : "low"),
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
    const rule = ruleFor("low_protein");
    if (avg < input.proteinGoalMin) {
      out.push({
        // <70% of goal → warn (reaches the dashboard banner); 70–99% → info (alerts page only)
        kind: "low_protein", severity: avg < input.proteinGoalMin * 0.70 ? "warn" : "info", // research: warn below 70% of the user's own target
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
    const rule = ruleFor("adherence_drop");
    // adherence_drop two-tier: < criticalAt(60) → warn (lower adherence is worse);
    // criticalAt..warnAt(80) → info. Both use the "low" bucket — one active row.
    const adhCrit = rule.criticalAt !== undefined && pct < rule.criticalAt;
    const adhWarn = rule.warnAt !== undefined && pct < rule.warnAt;
    if (adhCrit || adhWarn) {
      const severity = adhCrit ? "warn" : "info";
      out.push({
        kind: "adherence_drop", severity, title: rule.title,
        message: interp(adhCrit && rule.messageCritical ? rule.messageCritical : rule.messageWarn, `${Math.round(pct)}`),
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
      const rule = ruleFor("unsafe_stack");
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
    const rule = ruleFor("dehydration");
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
    const rule = ruleFor("side_effect_cluster");
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
  if (!rule) return; // unknown kind — defensive (catalog is exhaustive)
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
