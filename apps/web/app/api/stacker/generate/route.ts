import { stackerGenerateInput, type StackerGenerateInput } from "@peptide/shared";
import { wrapDoseLike, evaluateContraindications, type ContraindicationFinding } from "@peptide/peptides";
import type { StackerCatalogEntry } from "@peptide/agent";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateStack } from "@/lib/agent";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    // Cast to the output type — zod has applied the .default([]) values at runtime.
    const input = (await parseJson(req, stackerGenerateInput)) as StackerGenerateInput;
    const supabase = await createSupabaseServerClient();

    const [condRes, medRes, injRes, profileRes, catalogRes] = await Promise.all([
      supabase.from("conditions").select("name").eq("user_id", user.id).eq("active", true),
      supabase.from("medications").select("name").eq("user_id", user.id).eq("active", true),
      supabase.from("injuries").select("name").eq("user_id", user.id).eq("active", true),
      supabase.from("profiles").select("dob,sex").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("compounds")
        .select(
          "slug,name,category,evidence_level,fda_approved,absolute_contraindications,relative_contraindications",
        ),
    ]);

    const conditions = (condRes.data ?? []).map((c) => c.name as string);
    const medications = (medRes.data ?? []).map((m) => m.name as string);
    const injuries = (injRes.data ?? []).map((i) => i.name as string);
    const age = ageFromDob((profileRes.data?.dob as string | null) ?? null);
    const sex = (profileRes.data?.sex as string | null) ?? null;

    const catalogRows = catalogRes.data ?? [];
    const catalog: StackerCatalogEntry[] = catalogRows.map((c) => ({
      slug: c.slug as string,
      name: c.name as string,
      category: c.category as string,
      evidence_level: c.evidence_level as string,
      fda_approved: Boolean(c.fda_approved),
    }));

    const { plan, modelUsed } = await generateStack({
      goalKeys: input.goal_keys,
      freeText: input.free_text ?? null,
      profile: { conditions, medications, injuries, age, sex },
      catalog,
      userId: user.id,
    });

    // Quarantine ANY dose-like text — not just literature_dose_text — so a dose a
    // model slips into a prose field is still tagged for DoseAnnotatedText.
    const w = (s: string | null | undefined) => (s ? wrapDoseLike(s).wrappedText : s ?? "");
    const wrappedPlan = {
      ...plan,
      summary: w(plan.summary),
      phasing_rationale: w(plan.phasing_rationale),
      phases: plan.phases.map((phase) => ({
        ...phase,
        rationale: w(phase.rationale),
        items: phase.items.map((it) => ({
          ...it,
          why: w(it.why),
          literature_dose_text: it.literature_dose_text
            ? wrapDoseLike(it.literature_dose_text).wrappedText
            : null,
        })),
      })),
    };

    // Server-side contraindication report across all suggested compounds.
    const ciBySlug = new Map(
      catalogRows.map((c) => [
        c.slug as string,
        {
          slug: c.slug as string,
          name: c.name as string,
          absolute_contraindications: (c.absolute_contraindications as string[]) ?? [],
          relative_contraindications: (c.relative_contraindications as string[]) ?? [],
        },
      ]),
    );
    const suggestedSlugs = Array.from(
      new Set(plan.phases.flatMap((p) => p.items.map((i) => i.slug))),
    );
    const findings: ContraindicationFinding[] = suggestedSlugs.flatMap((slug) => {
      const c = ciBySlug.get(slug);
      return c ? evaluateContraindications(c, { conditions, medications, age }) : [];
    });

    return jsonOk({ plan: wrappedPlan, contraindications: findings, model: modelUsed });
  } catch (err) {
    return jsonError(err);
  }
}
