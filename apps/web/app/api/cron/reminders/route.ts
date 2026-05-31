/**
 * Reminder email cron. Invoked by Vercel Cron (GET with a Bearer CRON_SECRET).
 * Pages every user, reads their notification prefs, and dispatches up to three
 * lifecycle emails per run — weekly summary (Mondays), body-shot nudge, and a
 * daily dose/weigh-in reminder — gated by `shouldEmailReminder`. All stats are
 * the user's OWN logged data; nothing is prescribed. Idempotent per
 * (user, kind, day) via the `notification_sends` ledger.
 */
import {
  shouldEmailReminder,
  type NotificationSettings,
} from "@peptide/shared";
import {
  renderTemplate,
  emailConfig,
  type WeeklySummaryProps,
  type BodyShotReminderProps,
  type DoseWeighInReminderProps,
  type DueItem,
} from "@peptide/email";
import { sendEmailBatch, type BatchEmailMessage } from "@peptide/email/send";
import { list, del } from "@vercel/blob";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPORT_TTL_DAYS = 7;

/** UTC YYYY-MM-DD for a date. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The given instant rendered in an IANA timezone: local YYYY-MM-DD + whether
 * it's Monday there. Lets the once-daily cron evaluate eligibility (a user's
 * Monday, their day-counts) in local time instead of UTC. Falls back to UTC for
 * an unknown/invalid zone.
 */
function localParts(now: Date, tz: string): { ymd: string; isMonday: boolean } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const localYmd = `${get("year")}-${get("month")}-${get("day")}`;
    return { ymd: localYmd, isMonday: get("weekday") === "Mon" };
  } catch {
    return { ymd: ymd(now), isMonday: now.getUTCDay() === 1 };
  }
}

/** "May 19" style (UTC). */
function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

type EligibleEmail = {
  userId: string;
  kind: "weekly_summary" | "body_shot" | "dose_weigh_in";
  /** User's local date (their timezone) — the idempotency key for this send. */
  sentOn: string;
  message: BatchEmailMessage;
};

export async function GET(req: Request) {
  // Auth: require a configured secret AND a matching Bearer header.
  if (
    !serverEnv.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${serverEnv.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS).toISOString();

    const unsubscribeUrl = emailConfig.DEFAULT_UNSUBSCRIBE_URL;

    // ---- 1. Collect all users with an email (paginated) -------------------
    const users: { id: string; email: string }[] = [];
    const perPage = 1000;
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;
      const batch = data?.users ?? [];
      for (const u of batch) {
        if (u.email) users.push({ id: u.id, email: u.email });
      }
      if (batch.length < perPage) break;
    }

    const eligible: EligibleEmail[] = [];

    // ---- 2. Per-user: figure out which reminders to send ------------------
    for (const user of users) {
      try {
        const { data: settingsRow } = await supabase
          .from("user_settings")
          .select(
            "notification_channel, notify_weekly_summary, notify_body_shot, notify_dose_reminders, notify_weighin_reminder, notify_safety_alerts, body_photo_frequency_days, timezone",
          )
          .eq("user_id", user.id)
          .maybeSingle();

        // No settings row → user never finished setup; skip rather than
        // assume defaults and email someone who hasn't opted in.
        if (!settingsRow) continue;

        const settings = settingsRow as NotificationSettings & {
          body_photo_frequency_days: number | null;
          timezone: string | null;
        };

        // Evaluate "today"/Monday in the user's own timezone.
        const { ymd: localToday, isMonday } = localParts(
          now,
          settings.timezone || "UTC",
        );

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, created_at")
          .eq("id", user.id)
          .maybeSingle();

        const firstName =
          (profile?.display_name as string | null)?.trim().split(/\s+/)[0] ||
          undefined;

        // ---- weekly-summary (Mondays only) -------------------------------
        if (isMonday && shouldEmailReminder(settings, "weekly_summary")) {
          const weekly = await buildWeekly({
            supabase,
            userId: user.id,
            firstName,
            now,
            sevenDaysAgo,
            fourteenDaysAgo,
          });
          if (weekly) {
            const { html, text, subject } = await renderTemplate(
              "weekly-summary",
              weekly,
            );
            eligible.push({
              userId: user.id,
              kind: "weekly_summary",
              sentOn: localToday,
              message: { to: user.email, subject, html, text, unsubscribeUrl },
            });
          }
        }

        // ---- body-shot-reminder ------------------------------------------
        if (shouldEmailReminder(settings, "body_shot")) {
          const freq = settings.body_photo_frequency_days ?? 0;
          if (freq > 0) {
            const { data: lastPhoto } = await supabase
              .from("body_photos")
              .select("captured_at")
              .eq("user_id", user.id)
              .order("captured_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const anchorIso =
              (lastPhoto?.captured_at as string | undefined) ??
              (profile?.created_at as string | undefined);
            const anchor = anchorIso ? new Date(anchorIso) : null;
            const daysSinceLast = anchor
              ? Math.floor((now.getTime() - anchor.getTime()) / DAY_MS)
              : freq;

            // Due when there's never been a session, or it's past the cadence.
            if (!lastPhoto || daysSinceLast >= freq) {
              const props: BodyShotReminderProps = {
                firstName,
                daysSinceLast: Math.max(0, daysSinceLast),
                unsubscribeUrl,
              };
              const { html, text, subject } = await renderTemplate(
                "body-shot-reminder",
                props,
              );
              eligible.push({
                userId: user.id,
                kind: "body_shot",
                sentOn: localToday,
                message: { to: user.email, subject, html, text, unsubscribeUrl },
              });
            }
          }
        }

        // ---- dose-weigh-in-reminder --------------------------------------
        const wantsDose = shouldEmailReminder(settings, "dose");
        const wantsWeighIn = shouldEmailReminder(settings, "weigh_in");
        if (wantsDose || wantsWeighIn) {
          let items: DueItem[] = [];

          if (wantsDose) {
            const { data: activeStack } = await supabase
              .from("peptide_stacks")
              .select("id")
              .eq("user_id", user.id)
              .eq("is_active", true)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeStack?.id) {
              const { data: stackItems } = await supabase
                .from("peptide_stack_items")
                .select("frequency, route, compounds(name)")
                .eq("stack_id", activeStack.id as string);

              items = (stackItems ?? []).map((row) => {
                const r = row as {
                  frequency: string | null;
                  route: string | null;
                  compounds: { name: string } | { name: string }[] | null;
                };
                const compound = Array.isArray(r.compounds)
                  ? r.compounds[0]
                  : r.compounds;
                return {
                  label: compound?.name ?? "Scheduled compound",
                  detail: r.frequency ?? r.route ?? undefined,
                };
              });
            }
          }

          // Only send if there's something to show: due items and/or a weigh-in.
          if (items.length > 0 || wantsWeighIn) {
            const props: DoseWeighInReminderProps = {
              firstName,
              items,
              includeWeighIn: wantsWeighIn,
              unsubscribeUrl,
            };
            const { html, text, subject } = await renderTemplate(
              "dose-weigh-in-reminder",
              props,
            );
            eligible.push({
              userId: user.id,
              kind: "dose_weigh_in",
              sentOn: localToday,
              message: { to: user.email, subject, html, text, unsubscribeUrl },
            });
          }
        }
      } catch (userErr) {
        // One user's failure must not abort the whole run.
        console.error(`[cron/reminders] user ${user.id} failed`, userErr);
      }
    }

    // ---- 3. Idempotency: drop anything already sent today -----------------
    const toSend: EligibleEmail[] = [];
    for (const e of eligible) {
      try {
        const { data: existing } = await supabase
          .from("notification_sends")
          .select("id")
          .eq("user_id", e.userId)
          .eq("kind", e.kind)
          .eq("sent_on", e.sentOn)
          .maybeSingle();
        if (!existing) toSend.push(e);
      } catch (dedupeErr) {
        console.error(
          `[cron/reminders] dedupe check failed for ${e.userId}/${e.kind}`,
          dedupeErr,
        );
      }
    }

    // ---- 4. Send + record -------------------------------------------------
    if (toSend.length > 0) {
      await sendEmailBatch(toSend.map((e) => e.message));
      const rows = toSend.map((e) => ({
        user_id: e.userId,
        kind: e.kind,
        sent_on: e.sentOn,
      }));
      const { error: insertErr } = await supabase
        .from("notification_sends")
        .insert(rows);
      if (insertErr) {
        // Sends already went out; surface for ops but don't fail hard.
        console.error("[cron/reminders] recording sends failed", insertErr);
      }
    }

    const counts = { weekly: 0, bodyShot: 0, doseWeighIn: 0 };
    for (const e of toSend) {
      if (e.kind === "weekly_summary") counts.weekly++;
      else if (e.kind === "body_shot") counts.bodyShot++;
      else counts.doseWeighIn++;
    }

    // ---- 5. Clean up expired data-export blobs (TTL 7d) -------------------
    // Data exports are uploaded to exports/ with unguessable URLs; reap old
    // ones so they don't linger. Best-effort — never fail the run.
    let exportsDeleted = 0;
    try {
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const cutoff = now.getTime() - EXPORT_TTL_DAYS * DAY_MS;
        const stale: string[] = [];
        let cursor: string | undefined;
        do {
          const res = await list({
            prefix: "exports/",
            cursor,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });
          for (const b of res.blobs) {
            if (new Date(b.uploadedAt).getTime() < cutoff) stale.push(b.url);
          }
          cursor = res.cursor;
        } while (cursor);
        if (stale.length > 0) {
          await del(stale, { token: process.env.BLOB_READ_WRITE_TOKEN });
          exportsDeleted = stale.length;
        }
      }
    } catch (cleanupErr) {
      console.error("[cron/reminders] export cleanup failed", cleanupErr);
    }

    return jsonOk({ ...counts, exportsDeleted, scannedUsers: users.length });
  } catch (err) {
    return jsonError(err);
  }
}

/**
 * Best-effort weekly stats from the user's own logs. Returns null (skip) when
 * there are fewer than two weigh-ins in the last 14 days — not enough data for
 * a meaningful change line.
 */
async function buildWeekly(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  userId: string;
  firstName?: string;
  now: Date;
  sevenDaysAgo: string;
  fourteenDaysAgo: string;
}): Promise<WeeklySummaryProps | null> {
  const { supabase, userId, firstName, now, sevenDaysAgo, fourteenDaysAgo } =
    args;

  // Weigh-ins over the last 14d, oldest → newest.
  const { data: weighRows } = await supabase
    .from("weights")
    .select("value_lb, logged_at")
    .eq("user_id", userId)
    .gte("logged_at", fourteenDaysAgo)
    .order("logged_at", { ascending: true });

  const weighIns = (weighRows ?? [])
    .map((r) => ({
      value: Number((r as { value_lb: number | string }).value_lb),
      loggedAt: (r as { logged_at: string }).logged_at,
    }))
    .filter((w) => Number.isFinite(w.value));

  if (weighIns.length < 2) return null;

  const first = weighIns[0]!;
  const last = weighIns[weighIns.length - 1]!;
  const delta = last.value - first.value; // negative = lost weight

  // U+2212 minus for negative; plain "+" prefix for gains; magnitude to 1dp.
  const magnitude = Math.abs(delta).toFixed(1);
  const weightChange =
    delta < 0 ? `−${magnitude}` : delta > 0 ? `+${magnitude}` : "0.0";
  const weightTrend: "down" | "up" | "flat" =
    delta < -0.05 ? "down" : delta > 0.05 ? "up" : "flat";

  // Days with at least one weigh-in in the last 7 days (distinct UTC dates).
  const loggedDays = new Set<string>();
  for (const w of weighIns) {
    if (w.loggedAt >= sevenDaysAgo) loggedDays.add(w.loggedAt.slice(0, 10));
  }

  // Avg protein over last 7d.
  const { data: foodRows } = await supabase
    .from("food_logs")
    .select("protein_g")
    .eq("user_id", userId)
    .gte("logged_at", sevenDaysAgo);
  const proteinVals = (foodRows ?? [])
    .map((r) => Number((r as { protein_g: number | string }).protein_g))
    .filter((n) => Number.isFinite(n));
  const proteinAvg =
    proteinVals.length > 0
      ? Math.round(proteinVals.reduce((a, b) => a + b, 0) / proteinVals.length)
      : 0;

  // Dose adherence over last 7d: % of doses marked 'taken'.
  const { data: doseRows } = await supabase
    .from("peptide_doses")
    .select("adherence")
    .eq("user_id", userId)
    .gte("taken_at", sevenDaysAgo);
  const doses = doseRows ?? [];
  const takenCount = doses.filter(
    (r) => (r as { adherence: string }).adherence === "taken",
  ).length;
  const doseAdherencePct =
    doses.length > 0 ? Math.round((takenCount / doses.length) * 100) : 0;

  // Week range = trailing 7 days ending today.
  const weekStart = new Date(now.getTime() - 6 * DAY_MS);
  const weekRange = `${shortDate(weekStart)} – ${shortDate(now)}`;

  return {
    firstName,
    weekRange,
    weightChange,
    weightTrend,
    currentWeight: last.value.toFixed(1),
    proteinAvg: String(proteinAvg),
    doseAdherencePct,
    daysLogged: loggedDays.size,
    unsubscribeUrl: emailConfig.DEFAULT_UNSUBSCRIBE_URL,
  };
}
