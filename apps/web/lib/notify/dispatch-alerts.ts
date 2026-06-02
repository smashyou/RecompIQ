import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAlertsToNotify, type NotifyChannel, type NotifiableAlert } from "@peptide/peptides/alerts";
import type { EvidenceLevel } from "@peptide/shared";
import { sendEmail } from "@peptide/email/send";
import { serverEnv } from "@/lib/env";
import { sendPush } from "@/lib/notify/push";

interface AlertRow extends NotifiableAlert {
  title: string;
  message: string;
  evidence_level: string;
  citation: string;
}

const APP_URL = serverEnv.NEXT_PUBLIC_APP_URL;

/**
 * Send email + push for the user's un-notified alerts (mode = immediate→critical
 * only, digest→critical+warn). Stamps notified_at on what was sent and writes the
 * daily idempotency ledger. Best-effort: I/O failures are swallowed; notified_at
 * is only stamped when at least one channel succeeded.
 */
export async function dispatchAlertNotifications(
  supabase: SupabaseClient,
  userId: string,
  mode: "immediate" | "digest",
  ctx?: { email?: string; channel?: NotifyChannel; enabled?: boolean },
): Promise<{ emailed: boolean; pushed: number }> {
  // settings (load if not provided)
  let channel = ctx?.channel;
  let enabled = ctx?.enabled;
  if (channel === undefined || enabled === undefined) {
    const { data } = await supabase
      .from("user_settings")
      .select("notification_channel, notify_safety_alerts")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) {
      // No settings row → user never finished setup → not opted in (fail closed).
      channel = "off";
      enabled = false;
    } else {
      channel = (data.notification_channel as NotifyChannel) ?? "both";
      enabled = Boolean(data.notify_safety_alerts ?? true);
    }
  }

  const { data: rows } = await supabase
    .from("alerts")
    .select("id,severity,status,notified_at,title,message,evidence_level,citation")
    .eq("user_id", userId)
    .is("notified_at", null)
    .eq("status", "open");
  const alerts = (rows ?? []) as AlertRow[];

  const { toSend } = selectAlertsToNotify(alerts, { mode, channel, enabled });
  if (toSend.length === 0) return { emailed: false, pushed: 0 };

  const sevRank = { critical: 0, warn: 1, info: 2 } as Record<string, number>;
  toSend.sort((a, b) => sevRank[a.severity]! - sevRank[b.severity]!);

  let emailed = false;
  let pushed = 0;

  // email
  if (channel === "email" || channel === "both") {
    const email = ctx?.email ?? (await resolveEmail(supabase, userId));
    if (email) {
      try {
        await sendEmail({
          to: email,
          template: "safety-alert",
          props: {
            alerts: toSend.map((a) => ({
              title: a.title,
              message: a.message,
              severity: a.severity as "critical" | "warn",
              evidenceLevel: a.evidence_level as EvidenceLevel,
              citation: a.citation,
            })),
            alertsUrl: `${APP_URL}/alerts`,
          },
        });
        emailed = true;
      } catch {
        /* best-effort */
      }
    }
  }

  // push
  if (channel === "both") {
    const { data: toks } = await supabase.from("push_tokens").select("token").eq("user_id", userId);
    const tokens = (toks ?? []).map((t) => t.token as string);
    if (tokens.length > 0) {
      const top = toSend[0]!;
      const extra = toSend.length > 1 ? ` and ${toSend.length - 1} more` : "";
      const { sent, invalidTokens } = await sendPush(tokens, {
        title: "RecompIQ safety alert",
        body: `${top.title}${extra}`,
        data: { url: "/alerts" },
      });
      pushed = sent;
      if (invalidTokens.length > 0) {
        await supabase.from("push_tokens").delete().eq("user_id", userId).in("token", invalidTokens);
      }
    }
  }

  // stamp notified_at only if something went out (else retry next run)
  if (emailed || pushed > 0) {
    const nowIso = new Date().toISOString();
    await supabase
      .from("alerts")
      .update({ notified_at: nowIso })
      .in(
        "id",
        toSend.map((a) => a.id),
      );
    // daily idempotency ledger (digest dedupe)
    await supabase
      .from("notification_sends")
      .insert({ user_id: userId, kind: "safety_alert", sent_on: nowIso.slice(0, 10) })
      .then(
        () => {},
        () => {},
      );
  }
  return { emailed, pushed };
}

async function resolveEmail(supabase: SupabaseClient, userId: string): Promise<string | null> {
  // admin client can read auth users; fall back to null otherwise.
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}
