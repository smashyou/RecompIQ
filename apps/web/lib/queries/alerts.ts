import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scanRecentLogs, reconcileAlerts, type ExistingAlertRow } from "@peptide/peptides/alerts";
import { buildAlertScanInput } from "@/lib/alerts-input";

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

export async function loadAlerts(userId: string): Promise<AlertsView> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  // 1. scan
  const input = await buildAlertScanInput(userId);
  const findings = scanRecentLogs(input);

  // 2. reconcile against stored rows
  const { data: rows } = await supabase
    .from("alerts")
    .select("id,fingerprint,status")
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
  const visible = all.filter(
    (a) => a.status !== "resolved" && (!a.snoozed_until || a.snoozed_until <= nowIso),
  );
  visible.sort((a, b) => sevRank[a.severity]! - sevRank[b.severity]!);
  const active = visible;
  const history = all.filter(
    (a) => a.status === "resolved" || (a.snoozed_until !== null && a.snoozed_until > nowIso),
  );
  const openCount = active.filter(
    (a) => a.status === "open" && (a.severity === "critical" || a.severity === "warn"),
  ).length;
  return { active, history, openCount };
}
