import {
  scanRecentLogs,
  reconcileAlerts,
  type ExistingAlertRow,
} from "@peptide/peptides/alerts";
import type { AlertScanInput } from "@peptide/shared/alerts";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { loadActiveRegimen } from "@/lib/regimen";

// Mobile mirror of apps/web/lib/alerts-input.ts + lib/queries/alerts.ts.
// Builds the engine's AlertScanInput from supabase-js reads, runs the PURE
// scanRecentLogs + reconcileAlerts, performs the same insert/bump/resolve
// writes, and returns the active + history views. Every numeric is coerced.
// Alerts are observations for clinician discussion — never prescriptions.

const OZ_TO_ML = 29.5735;
const dayOf = (iso: string) => String(iso).slice(0, 10);

export interface AlertRow {
  id: string;
  kind: string;
  severity: "info" | "warn" | "critical";
  title: string;
  message: string;
  evidence: Record<string, unknown>;
  evidence_level: string;
  citation: string;
  status: "open" | "acknowledged" | "resolved";
  first_detected_at: string;
  last_detected_at: string;
  snoozed_until: string | null;
  resolved_at: string | null;
}

export interface AlertsView {
  active: AlertRow[];
  history: AlertRow[];
  openCount: number;
}

async function buildAlertScanInput(userId: string): Promise<AlertScanInput> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    profile,
    goal,
    weights,
    vitals,
    foods,
    doses,
    metrics,
    symptoms,
    waters,
    conditions,
    medications,
    injuries,
    regimen,
  ] = await Promise.all([
    supabase.from("profiles").select("dob,sex").eq("user_id", userId).maybeSingle(),
    supabase
      .from("goals")
      .select("protein_target_g_min")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weights")
      .select("logged_at,value_lb")
      .eq("user_id", userId)
      .order("logged_at", { ascending: true })
      .limit(30),
    supabase
      .from("vitals")
      .select("logged_at,bp_systolic,bp_diastolic,glucose_mgdl")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(30),
    supabase
      .from("food_logs")
      .select("logged_at,protein_g")
      .eq("user_id", userId)
      .gte("logged_at", sevenDaysAgo.toISOString())
      .order("logged_at", { ascending: false }),
    supabase
      .from("peptide_doses")
      .select("taken_at,adherence")
      .eq("user_id", userId)
      .order("taken_at", { ascending: false })
      .limit(30),
    supabase
      .from("goal_metrics")
      .select("metric_key,value,logged_at")
      .eq("user_id", userId)
      .in("metric_key", ["neuro_severity", "nausea_severity"])
      .order("logged_at", { ascending: false })
      .limit(60),
    supabase
      .from("symptoms")
      .select("logged_at,nausea")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(30),
    supabase
      .from("water_logs")
      .select("logged_at,volume_oz")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(60),
    supabase.from("conditions").select("name").eq("user_id", userId).eq("active", true),
    supabase.from("medications").select("name").eq("user_id", userId).eq("active", true),
    supabase.from("injuries").select("name").eq("user_id", userId).eq("active", true),
    loadActiveRegimen(userId),
  ]);

  // --- protein summed per logged day (last ~7 days) ---
  const proteinMap = new Map<string, number>();
  for (const f of (foods.data ?? []) as any[]) {
    const day = dayOf(f.logged_at);
    proteinMap.set(day, (proteinMap.get(day) ?? 0) + Number(f.protein_g));
  }
  const proteinByDay = Array.from(proteinMap.entries()).map(([day, protein_g]) => ({
    day,
    protein_g,
  }));

  // --- water summed per day, oz -> ml ---
  const waterMap = new Map<string, number>();
  for (const w of (waters.data ?? []) as any[]) {
    const day = dayOf(w.logged_at);
    waterMap.set(day, (waterMap.get(day) ?? 0) + Number(w.volume_oz) * OZ_TO_ML);
  }
  const waterByDay = Array.from(waterMap.entries()).map(([day, ml]) => ({ day, ml }));

  // --- active compounds from the current regimen ---
  const activeCompounds = (regimen?.currentItems ?? [])
    .map((i) => i.compound)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      absolute_contraindications: c.absolute_contraindications,
      relative_contraindications: c.relative_contraindications,
    }));

  // --- age from dob, sex from profile ---
  const dob = (profile.data as any)?.dob as string | null | undefined;
  let age: number | null = null;
  if (dob) {
    const d = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
    age = Number.isFinite(years) ? years : null;
  }
  const sex = ((profile.data as any)?.sex as string | null | undefined) ?? null;

  return {
    weights: ((weights.data ?? []) as any[]).map((w) => ({
      logged_at: w.logged_at as string,
      value_lb: Number(w.value_lb),
    })),
    vitals: ((vitals.data ?? []) as any[]).map((v) => ({
      logged_at: v.logged_at as string,
      bp_systolic: v.bp_systolic !== null ? Number(v.bp_systolic) : null,
      bp_diastolic: v.bp_diastolic !== null ? Number(v.bp_diastolic) : null,
      glucose_mgdl: v.glucose_mgdl !== null ? Number(v.glucose_mgdl) : null,
    })),
    proteinByDay,
    proteinGoalMin:
      (goal.data as any)?.protein_target_g_min != null
        ? Number((goal.data as any).protein_target_g_min)
        : null,
    doses: ((doses.data ?? []) as any[]).map((d) => ({
      taken_at: d.taken_at as string,
      adherence: d.adherence as string,
    })),
    metrics: ((metrics.data ?? []) as any[]).map((m) => ({
      metric_key: m.metric_key as string,
      value: Number(m.value),
      logged_at: m.logged_at as string,
    })),
    symptoms: ((symptoms.data ?? []) as any[]).map((s) => ({
      logged_at: s.logged_at as string,
      nausea: (s.nausea as boolean | null) ?? null,
    })),
    waterByDay,
    activeCompounds,
    health: {
      conditions: ((conditions.data ?? []) as any[]).map((c) => c.name as string),
      medications: ((medications.data ?? []) as any[]).map((m) => m.name as string),
      injuries: ((injuries.data ?? []) as any[]).map((i) => i.name as string),
      age,
      sex,
    },
    now: new Date().toISOString(),
  };
}

/**
 * Reconcile-on-load: scan recent logs, diff against stored alert rows, persist
 * insert/bump/resolve (mirrors the web loader exactly), then read back for
 * display. Returns active (open, unsnoozed) + history (handled) + open count.
 */
export async function loadAlerts(userId: string): Promise<AlertsView> {
  const nowIso = new Date().toISOString();

  // 1. scan
  const input = await buildAlertScanInput(userId);
  const findings = scanRecentLogs(input);

  // 2. reconcile against stored rows
  const { data: rows } = await supabase
    .from("alerts")
    .select("id,fingerprint,status")
    .eq("user_id", userId);
  const existing = ((rows ?? []) as any[]) as ExistingAlertRow[];
  const plan = reconcileAlerts(findings, existing, nowIso);

  if (plan.toInsert.length) {
    await supabase.from("alerts").insert(
      plan.toInsert.map((f) => ({
        user_id: userId,
        kind: f.kind,
        severity: f.severity,
        fingerprint: f.fingerprint,
        title: f.title,
        message: f.message,
        evidence: f.evidence,
        evidence_level: f.evidenceLevel,
        citation: f.citation,
        status: "open",
        last_detected_at: nowIso,
      })),
    );
  }
  for (const r of plan.toBump) {
    await supabase.from("alerts").update({ last_detected_at: nowIso }).eq("id", r.id);
  }
  if (plan.toResolve.length) {
    await supabase
      .from("alerts")
      .update({ status: "resolved", resolved_at: nowIso })
      .in(
        "id",
        plan.toResolve.map((r) => r.id),
      );
  }

  // Best-effort: tell the server to fire immediate-critical email/push for any
  // un-notified critical alerts just reconciled. Bearer is attached by apiFetch
  // and validated by requireUser on the route. Never blocks the UI.
  try {
    await apiFetch("/api/alerts/dispatch", { method: "POST", body: "{}" });
  } catch {
    /* best-effort */
  }

  // 3. read back for display
  const { data: fresh } = await supabase
    .from("alerts")
    .select(
      "id,kind,severity,title,message,evidence,evidence_level,citation,status,first_detected_at,last_detected_at,snoozed_until,resolved_at",
    )
    .eq("user_id", userId)
    .order("severity", { ascending: true })
    .order("last_detected_at", { ascending: false });
  const all = ((fresh ?? []) as any[]) as AlertRow[];
  const sevRank = { critical: 0, warn: 1, info: 2 } as Record<string, number>;
  const isFutureSnoozed = (a: AlertRow) => a.snoozed_until !== null && a.snoozed_until > nowIso;
  const active = all
    .filter((a) => a.status === "open" && !isFutureSnoozed(a))
    .sort((a, b) => sevRank[a.severity]! - sevRank[b.severity]!);
  const history = all.filter((a) => a.status !== "open" || isFutureSnoozed(a));
  const openCount = active.filter(
    (a) => a.severity === "critical" || a.severity === "warn",
  ).length;
  return { active, history, openCount };
}

/** Acknowledge an alert (moves it to history; mirrors the web /ack route). */
export async function acknowledgeAlert(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("alerts")
    .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Snooze an alert for `days` (default 7); mirrors the web /snooze route. */
export async function snoozeAlert(userId: string, id: string, days = 7): Promise<void> {
  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await supabase
    .from("alerts")
    .update({ snoozed_until: until })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Cheap open-count read for the menu badge — no reconcile / no writes. */
export async function countOpenAlerts(userId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { count } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "open")
    .in("severity", ["critical", "warn"])
    .or(`snoozed_until.is.null,snoozed_until.lte.${nowIso}`);
  return count ?? 0;
}
