/**
 * Daily-insight cron endpoints. Bearer CRON_SECRET on both verbs.
 *
 * GET  → de-identified snapshots for every user due an insight today.
 * POST → write generated insights back, AFTER the safety guard.
 *
 * WHY A ROUTE PAIR AND NOT A SERVICE-ROLE KEY ON THE BOX: the generator runs on
 * a VPS that also hosts a dozen unrelated agents. Shipping RecompIQ's
 * service-role key there would put every one of 44 tables of health data behind
 * whatever the weakest thing on that box is. These two routes are the entire
 * blast radius instead — read a narrow snapshot, write a guarded insight.
 *
 * The guard runs HERE, not on the VPS, because this is the one chokepoint every
 * backend shares. Swapping the generator from the $0 Claude Code CLI to the
 * metered gateway (or to anything else) cannot route around it.
 */
import { checkInsight, type InsightDraft } from "@peptide/peptides/insights";
import { redactedLogger } from "@peptide/shared/logger";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildInsightSnapshot, type InsightSnapshot } from "@/lib/queries/insight-snapshot";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  return (
    Boolean(serverEnv.CRON_SECRET) &&
    req.headers.get("authorization") === `Bearer ${serverEnv.CRON_SECRET}`
  );
}

/** Every catalog compound name + slug — the vocabulary the guard matches against. */
async function loadCatalogCompounds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<string[]> {
  const { data } = await supabase.from("compounds").select("name,slug");
  const rows = (data ?? []) as { name: string; slug: string }[];
  return [...new Set(rows.flatMap((r) => [r.name, r.slug]).filter(Boolean))];
}

// ---------------------------------------------------------------------------
// GET — who needs an insight, and what do they look like
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

  try {
    const supabase = createSupabaseAdminClient();

    const users: string[] = [];
    const perPage = 1000;
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const batch = data?.users ?? [];
      for (const u of batch) users.push(u.id);
      if (batch.length < perPage) break;
    }

    const snapshots: InsightSnapshot[] = [];
    const skipped: { user_id: string; reason: string }[] = [];

    for (const userId of users) {
      try {
        const snapshot = await buildInsightSnapshot(supabase, userId);

        // Already generated for this user's local day — idempotent re-runs.
        const { data: existing } = await supabase
          .from("ai_insights")
          .select("id")
          .eq("user_id", userId)
          .eq("generated_for", snapshot.generated_for)
          .maybeSingle();
        if (existing) {
          skipped.push({ user_id: userId, reason: "already_generated" });
          continue;
        }

        // Nothing to say is better than something invented. An account with no
        // weigh-ins and no logs would force the model to pad.
        const signalCount =
          snapshot.weights.length +
          snapshot.daily_intake.length +
          snapshot.doses.length +
          snapshot.workouts.length;
        if (signalCount < 3) {
          skipped.push({ user_id: userId, reason: "insufficient_data" });
          continue;
        }

        snapshots.push(snapshot);
      } catch (err) {
        redactedLogger.warn("insight snapshot failed", {
          user_id: userId,
          message: err instanceof Error ? err.message : String(err),
        });
        skipped.push({ user_id: userId, reason: "error" });
      }
    }

    const catalogCompounds = await loadCatalogCompounds(supabase);
    return Response.json({ snapshots, skipped, catalog_compounds: catalogCompounds });
  } catch (err) {
    redactedLogger.warn("insight cron GET failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response("Internal error", { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — guarded write-back
// ---------------------------------------------------------------------------
const insightBody = z.object({
  insights: z
    .array(
      z.object({
        user_id: z.string().uuid(),
        generated_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        headline: z.string().trim().min(1),
        body: z.string().trim().min(1),
        observations: z
          .array(z.object({ signal: z.string().trim().min(1), detail: z.string().trim().min(1) }))
          .default([]),
        clinician_prompt: z.string().trim().nullable().default(null),
        evidence_level: z.string().trim().nullable().default(null),
        source: z.enum(["vps_cli", "gateway", "template"]).default("vps_cli"),
        model: z.string().trim().nullable().default(null),
      }),
    )
    .max(200),
});

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

  let parsed: z.infer<typeof insightBody>;
  try {
    parsed = insightBody.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: "invalid body", detail: err instanceof Error ? err.message.slice(0, 300) : "unknown" },
      { status: 400 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();
    const catalogCompounds = await loadCatalogCompounds(supabase);

    const written: string[] = [];
    const rejected: { user_id: string; violations: { rule: string; detail: string }[] }[] = [];

    for (const item of parsed.insights) {
      const snapshot = await buildInsightSnapshot(supabase, item.user_id);

      const draft: InsightDraft = {
        headline: item.headline,
        body: item.body,
        observations: item.observations,
        clinicianPrompt: item.clinician_prompt,
      };
      const verdict = checkInsight(draft, {
        knownCompounds: snapshot.known_compounds,
        catalogCompounds,
      });

      if (!verdict.ok) {
        // Rejections are logged with their rules, not silently dropped: the same
        // rule tripping every day is a prompt bug, and that is only visible if
        // the rule is recorded. No insight text is logged — it describes health.
        redactedLogger.warn("insight rejected by safety guard", {
          user_id: item.user_id,
          rules: verdict.violations.map((v) => v.rule).join(","),
        });
        rejected.push({ user_id: item.user_id, violations: verdict.violations });
        continue;
      }

      const { error } = await supabase.from("ai_insights").upsert(
        {
          user_id: item.user_id,
          generated_for: item.generated_for,
          headline: item.headline,
          body: item.body,
          observations: item.observations,
          clinician_prompt: item.clinician_prompt,
          evidence_level: item.evidence_level,
          source: item.source,
          model: item.model,
          status: "active",
        },
        { onConflict: "user_id,generated_for" },
      );
      if (error) throw error;
      written.push(item.user_id);
    }

    return Response.json({ written: written.length, rejected });
  } catch (err) {
    redactedLogger.warn("insight cron POST failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response("Internal error", { status: 500 });
  }
}
