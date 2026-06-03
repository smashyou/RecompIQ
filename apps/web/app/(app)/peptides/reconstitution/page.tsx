import type { EvidenceLevel } from "@peptide/shared";
import { ReconstitutionCalculator, type CompoundOption } from "./calculator";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";

export const dynamic = "force-dynamic";

interface CompoundRow {
  id: string;
  slug: string;
  name: string;
  is_blend: boolean | null;
  typical_vial_mg: number | null;
  component_mg: { label: string; mg: number | null }[] | null;
}
interface DoseRefRow {
  compound_id: string;
  low_value: number | null;
  high_value: number | null;
  unit: string;
  is_human_data: boolean | null;
  evidence_level: EvidenceLevel;
}

export default async function ReconstitutionPage({
  searchParams,
}: {
  searchParams: Promise<{ compound?: string }>;
}) {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { compound: initialSlug } = await searchParams;

  // Mirror the mobile loader: compounds (vial size + composition) + reference
  // doses (prefer human-data rows). Doses here are factual literature ranges
  // used only for quick-fill — the calculator does math, it does not prescribe.
  const [compoundsRes, refsRes] = await Promise.all([
    supabase
      .from("compounds")
      .select("id, slug, name, is_blend, typical_vial_mg, component_mg")
      .order("name"),
    supabase
      .from("compound_dose_reference")
      .select("compound_id, low_value, high_value, unit, is_human_data, evidence_level"),
  ]);

  const refDose = new Map<
    string,
    { low: number; high: number; unit: string; evidence_level: EvidenceLevel }
  >();
  for (const r of (refsRes.data ?? []) as DoseRefRow[]) {
    if (r.low_value == null) continue;
    const existing = refDose.get(r.compound_id);
    if (!existing || r.is_human_data) {
      refDose.set(r.compound_id, {
        low: Number(r.low_value),
        high: Number(r.high_value ?? r.low_value),
        unit: r.unit,
        evidence_level: r.evidence_level,
      });
    }
  }

  const options: CompoundOption[] = ((compoundsRes.data ?? []) as CompoundRow[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    is_blend: c.is_blend ?? false,
    typical_vial_mg: c.typical_vial_mg,
    component_mg: (c.component_mg ?? []).filter((x) => x && typeof x.label === "string"),
    ref_dose: refDose.get(c.id) ?? null,
  }));

  return (
    <div>
      <SectionHeader title="Reconstitution calculator" note="math on your inputs" />
      <p className="mb-6 font-[family-name:var(--font-sans)] text-sm leading-[1.55] text-[var(--fg-muted)]">
        Calculates concentration, draw volume, and insulin-syringe units from vial size +
        bacteriostatic water + your dose. Pick a peptide to load its vial size and literature
        reference dose, flip to reverse mode to back-calculate a dose from units drawn, and see the
        per-component breakdown for blends. It does math on the numbers you enter — it does not
        recommend doses.
      </p>
      <ReconstitutionCalculator options={options} initialSlug={initialSlug ?? null} />
      <div className="mt-6">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}
