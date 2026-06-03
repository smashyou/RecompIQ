import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scanRecentLogs, reconcileAlerts, didEscalate, type ExistingAlertRow } from "@peptide/peptides/alerts";
import { buildAlertScanInput } from "@/lib/alerts-input";
import { dispatchAlertNotifications } from "@/lib/notify/dispatch-alerts";

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

/**
 * Cheap, read-only count of open critical/warn alerts (no reconcile / no writes).
 * Safe to call on every app-layout render — a single head/count query. Excludes
 * alerts snoozed into the future.
 */
export async function countOpenAlerts(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
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

/**
 * Reconcile the user's recent logged data into stored alert rows: scan → diff
 * against stored rows → insert new (status 'open'), bump last_detected_at on
 * still-present ones, resolve gone ones. Takes the client so both the per-request
 * web loader and the cron's admin client can run the identical reconcile.
 */
export async function reconcileUserAlerts(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1. scan
  const input = await buildAlertScanInput(supabase, userId);
  const findings = scanRecentLogs(input);

  // 2. reconcile against stored rows
  const { data: rows } = await supabase
    .from("alerts")
    .select("id,fingerprint,status,severity")
    .eq("user_id", userId);
  const existing = (rows ?? []) as ExistingAlertRow[];
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
  for (const { row, finding } of plan.toBump) {
    await supabase.from("alerts").update({
      last_detected_at: nowIso,
      severity: finding.severity,
      title: finding.title,
      message: finding.message,
      evidence: finding.evidence,
      evidence_level: finding.evidenceLevel,
      citation: finding.citation,
      ...(didEscalate(row.severity, finding.severity) ? { notified_at: null } : {}),
    }).eq("id", row.id);
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
}

export async function loadAlerts(userId: string, email?: string): Promise<AlertsView> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  // 1+2. scan + reconcile (insert/bump/resolve)
  await reconcileUserAlerts(supabase, userId);

  // 2b. fire off-app notifications for immediate-critical alerts. The per-request
  // server client lacks auth.admin, so pass the session email through explicitly.
  // Best-effort: a notify failure must never break rendering the alerts page.
  try {
    await dispatchAlertNotifications(supabase, userId, "immediate", { email });
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
  const all = (fresh ?? []) as AlertRow[];
  const sevRank = { critical: 0, warn: 1, info: 2 } as Record<string, number>;
  // Acknowledged + snoozed-into-the-future alerts are "handled" → history, so the
  // optimistic client removal persists across reloads. Only OPEN, unsnoozed are active.
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
