import { stackerApplyInput, type StackerApplyInput, AppError } from "@peptide/shared";
import { evaluateContraindications } from "@peptide/peptides";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureActiveRegimen } from "@/lib/regimen-write";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripEdu = (s: string) => s.replace(/\[\/?edu\]/g, "");
const today = () => new Date().toISOString().slice(0, 10);

// Apply an accepted AI plan: creates user_goals + regimen phases + ai_suggested
// items (dose BLANK — the user sets their own). Nothing prescribed.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    // Cast to the output type — zod has applied the .default([]) values at runtime.
    const { plan, goal_keys } = (await parseJson(req, stackerApplyInput)) as StackerApplyInput;
    const supabase = await createSupabaseServerClient();

    // 1. Upsert the goals (priority by order).
    if (goal_keys.length > 0) {
      await supabase.from("user_goals").upsert(
        goal_keys.map((goal_key, i) => ({
          user_id: user.id,
          goal_key,
          priority: i + 1,
          status: "active",
        })),
        { onConflict: "user_id,goal_key" },
      );
    }
    const { data: goalRows } = await supabase
      .from("user_goals")
      .select("id,goal_key")
      .eq("user_id", user.id);
    const goalIdByKey = new Map((goalRows ?? []).map((g) => [g.goal_key as string, g.id as string]));

    // 2. Resolve compound slugs → ids. Looking up by slug is ALSO the intentional
    // hallucination guard: any slug not in the catalog is dropped (step 4).
    const slugs = Array.from(new Set(plan.phases.flatMap((p) => p.items.map((i) => i.slug))));
    const { data: compounds } = slugs.length
      ? await supabase
          .from("compounds")
          .select("id,slug,name,typical_route,absolute_contraindications,relative_contraindications")
          .in("slug", slugs)
      : { data: [] as never[] };
    const compoundBySlug = new Map((compounds ?? []).map((c) => [c.slug as string, c]));

    // SAFETY (server-authoritative): re-run the contraindication check here — the
    // generate-time check is client-trusted and dismissible. Block apply on any
    // ABSOLUTE contraindication against the user's recorded profile.
    const [condRes, medRes, profRes] = await Promise.all([
      supabase.from("conditions").select("name").eq("user_id", user.id).eq("active", true),
      supabase.from("medications").select("name").eq("user_id", user.id).eq("active", true),
      supabase.from("profiles").select("dob").eq("user_id", user.id).maybeSingle(),
    ]);
    const conditions = (condRes.data ?? []).map((c) => c.name as string);
    const medications = (medRes.data ?? []).map((m) => m.name as string);
    const age = ageFromDob((profRes.data?.dob as string | null) ?? null);
    const absolute = slugs.flatMap((slug) => {
      const c = compoundBySlug.get(slug) as
        | { slug: string; name: string; absolute_contraindications?: string[]; relative_contraindications?: string[] }
        | undefined;
      if (!c) return [];
      return evaluateContraindications(
        {
          slug: c.slug,
          name: c.name,
          absolute_contraindications: c.absolute_contraindications ?? [],
          relative_contraindications: c.relative_contraindications ?? [],
        },
        { conditions, medications, age },
      ).filter((f) => f.severity === "absolute");
    });
    if (absolute.length > 0) {
      throw new AppError(
        "VALIDATION_FAILED",
        `Cannot apply: absolute contraindication flagged (${absolute
          .map((f) => `${f.compoundName ?? ""} — ${f.reason ?? ""}`.trim())
          .slice(0, 3)
          .join("; ")}). Discuss with your clinician.`,
      );
    }

    // 3. Append the plan's phases to the active regimen.
    const regimenId = await ensureActiveRegimen(supabase, user.id);
    const { data: maxRow } = await supabase
      .from("regimen_phases")
      .select("ordinal")
      .eq("regimen_id", regimenId)
      .order("ordinal", { ascending: false })
      .limit(1)
      .maybeSingle();
    let ordinal = (maxRow?.ordinal ?? 0) + 1;

    let itemCount = 0;
    for (const phase of plan.phases) {
      const goalIds = phase.goal_keys
        .map((k) => goalIdByKey.get(k))
        .filter((v): v is string => Boolean(v));
      const { data: phaseRow, error: phaseErr } = await supabase
        .from("regimen_phases")
        .insert({
          regimen_id: regimenId,
          user_id: user.id,
          ordinal: ordinal++,
          name: phase.name,
          goal_ids: goalIds,
          starts_on: today(),
          notes: phase.rationale ? stripEdu(phase.rationale).slice(0, 2000) : null,
        })
        .select("id")
        .single();
      if (phaseErr) throw phaseErr;
      const phaseId = phaseRow.id as string;

      await supabase.from("regimen_changes").insert({
        regimen_id: regimenId,
        user_id: user.id,
        kind: "phase_add",
        after: { phase_id: phaseId, name: phase.name },
        effective_on: today(),
      });

      const itemRows = phase.items
        .map((it) => {
          const c = compoundBySlug.get(it.slug);
          if (!c) return null;
          const lit = it.literature_dose_text ? ` · literature: ${stripEdu(it.literature_dose_text)}` : "";
          return {
            regimen_id: regimenId,
            phase_id: phaseId,
            user_id: user.id,
            compound_id: c.id,
            dose_value: null, // user sets their own — never fabricated
            dose_unit: null,
            route: c.typical_route ?? null,
            frequency: null,
            source: "ai_suggested" as const,
            starts_on: today(),
            notes: `AI-suggested${lit}`.slice(0, 2000),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (itemRows.length > 0) {
        const { data: inserted, error: itemsErr } = await supabase
          .from("regimen_items")
          .insert(itemRows)
          .select("id,compound_id");
        if (itemsErr) throw itemsErr;
        itemCount += inserted?.length ?? 0;
        if (inserted && inserted.length > 0) {
          await supabase.from("regimen_changes").insert(
            inserted.map((it) => ({
              regimen_id: regimenId,
              item_id: it.id,
              user_id: user.id,
              kind: "add" as const,
              after: { compound_id: it.compound_id, source: "ai_suggested" },
              effective_on: today(),
            })),
          );
        }
      }
    }

    return jsonOk({ goals: goal_keys.length, phases: plan.phases.length, items: itemCount });
  } catch (err) {
    return jsonError(err);
  }
}
