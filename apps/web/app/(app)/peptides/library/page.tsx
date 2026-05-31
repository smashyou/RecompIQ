import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";
import { representativeRange, commonFrequency, type DoseRefLike } from "@/lib/dose-display";
import { LibraryGrid, type LibraryCard } from "./library-grid";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();

  const [compoundsRes, refsRes] = await Promise.all([
    supabase
      .from("compounds")
      .select(
        "id,slug,name,category,evidence_level,fda_approved,typical_route,short_description,is_blend,component_slugs",
      )
      .order("name"),
    supabase
      .from("compound_dose_reference")
      .select("compound_id,low_value,high_value,unit,frequency,is_human_data,context,route,evidence_level"),
  ]);

  const compounds = compoundsRes.data ?? [];
  const refs = (refsRes.data ?? []) as (DoseRefLike & { compound_id: string })[];

  const refsByCompound = new Map<string, DoseRefLike[]>();
  for (const r of refs) {
    const list = refsByCompound.get(r.compound_id) ?? [];
    list.push(r);
    refsByCompound.set(r.compound_id, list);
  }

  const cards: LibraryCard[] = compounds.map((c) => {
    const cRefs = refsByCompound.get(c.id) ?? [];
    return {
      slug: c.slug,
      name: c.name,
      category: c.category,
      evidence_level: c.evidence_level,
      fda_approved: c.fda_approved,
      typical_route: c.typical_route,
      blurb: (c.short_description ?? "").slice(0, 120),
      dose: representativeRange(cRefs),
      frequency: commonFrequency(cRefs),
      is_blend: c.is_blend ?? false,
      component_count: (c.component_slugs ?? []).length,
    };
  });

  return (
    <div className="mx-auto max-w-[980px]">
      <SectionHeader title="Protocol library" note={`${cards.length} compounds`} />

      <p className="mb-6 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Evidence-graded reference, sourced from public literature. Educational only, not medical
        advice.
      </p>

      <LibraryGrid cards={cards} />

      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}
