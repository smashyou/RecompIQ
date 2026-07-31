import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** A generated insight as the dashboard renders it. Plain data — safe to pass to a client component. */
export interface DashboardInsight {
  id: string;
  generatedFor: string;
  headline: string;
  body: string;
  observations: { signal: string; detail: string }[];
  clinicianPrompt: string | null;
  source: string;
}

/**
 * The user's most recent undismissed insight, if it is still current.
 *
 * Deliberately bounded to the last 2 days: a stale insight presented as today's
 * read on the user's data is worse than the honest fallback, because the card
 * gives no hint of its age. When the generator has not run, the dashboard drops
 * back to the derived template rather than showing week-old observations.
 */
export async function loadLatestInsight(userId: string): Promise<DashboardInsight | null> {
  const supabase = await createSupabaseServerClient();
  const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("ai_insights")
    .select("id,generated_for,headline,body,observations,clinician_prompt,source")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("generated_for", cutoff)
    .order("generated_for", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    id: string;
    generated_for: string;
    headline: string;
    body: string;
    observations: unknown;
    clinician_prompt: string | null;
    source: string;
  };

  return {
    id: row.id,
    generatedFor: row.generated_for,
    headline: row.headline,
    body: row.body,
    observations: Array.isArray(row.observations)
      ? (row.observations as { signal: string; detail: string }[])
      : [],
    clinicianPrompt: row.clinician_prompt,
    source: row.source,
  };
}
