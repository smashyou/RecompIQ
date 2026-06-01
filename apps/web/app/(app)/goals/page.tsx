import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GOAL_TAXONOMY } from "@peptide/shared";
import { SectionHeader } from "@/components/kit";
import { GoalsClient } from "./goals-client";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const wantedSlugs = Array.from(new Set(GOAL_TAXONOMY.flatMap((g) => g.representativeSlugs)));
  const [goalsRes, compoundsRes] = await Promise.all([
    supabase.from("user_goals").select("goal_key,priority").eq("user_id", user.id).order("priority"),
    supabase.from("compounds").select("slug,name").in("slug", wantedSlugs),
  ]);

  const initialSelected = (goalsRes.data ?? []).map((g) => g.goal_key as string);
  const compoundNames: Record<string, string> = {};
  for (const c of compoundsRes.data ?? []) compoundNames[c.slug as string] = c.name as string;

  return (
    <div className="mx-auto max-w-[860px]">
      <SectionHeader title="Your goals" note="what we track, suggest, and project" />
      <p className="mb-5 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Pick the outcomes you care about. Goals decide what RecompIQ tracks and projects, and they
        guide the AI when it helps you assemble a regimen. You can pick several — priority follows the
        order you select.
      </p>
      <GoalsClient initialSelected={initialSelected} compoundNames={compoundNames} />
    </div>
  );
}
