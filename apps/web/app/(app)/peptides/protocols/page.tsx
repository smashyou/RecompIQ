import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { doseRangeWrapped } from "@/lib/dose-display";
import { ProtocolsHub } from "./hub";
import type { ReferenceCompound, DoseReference, CompoundSynergy } from "./compound-reference-tab";
import type { ProtocolSchedule } from "./titration-tab";

export const dynamic = "force-dynamic";

interface CompoundRow {
  id: string;
  slug: string;
  name: string;
  evidence_level: string;
  fda_approved: boolean;
  mechanism: string | null;
  monitoring_notes: string[];
  is_blend: boolean;
  typical_vial_mg: number | null;
  component_mg: { label: string; mg: number | null }[];
}

interface DoseRefRow {
  id: string;
  compound_id: string;
  context: string;
  route: string | null;
  low_value: number | null;
  high_value: number | null;
  unit: string;
  frequency: string | null;
  evidence_level: string;
  is_human_data: boolean;
  citation: { source?: string; title?: string; url?: string; year?: number }[] | null;
  notes: string | null;
}

function rangeText(row: DoseRefRow): string {
  return doseRangeWrapped(row);
}

export default async function ProtocolsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; compound?: string }>;
}) {
  await requireUser();
  const { tab, compound: compoundSlug } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [compoundsRes, refsRes, synRes, schedulesRes] = await Promise.all([
    supabase
      .from("compounds")
      .select("id,slug,name,evidence_level,fda_approved,mechanism,monitoring_notes,is_blend,typical_vial_mg,component_mg")
      .order("name"),
    supabase.from("compound_dose_reference").select("*").order("context"),
    supabase
      .from("compound_synergies")
      .select("id,compound_id,paired_name,rationale,evidence_level,is_human_data,caution_notes")
      .order("paired_name"),
    supabase
      .from("protocol_schedules")
      .select("*, protocol_schedule_weeks(*, compounds(slug,name))")
      .order("created_at", { ascending: false }),
  ]);

  const compounds = (compoundsRes.data ?? []) as CompoundRow[];
  const refRows = (refsRes.data ?? []) as DoseRefRow[];
  const synRows = (synRes.data ?? []) as (CompoundSynergy & { compound_id: string })[];
  const schedules = (schedulesRes.data ?? []) as ProtocolSchedule[];

  // Group dose references under their compound, pre-wrapping the range string.
  const refsByCompound = new Map<string, DoseReference[]>();
  for (const row of refRows) {
    const ref: DoseReference = {
      id: row.id,
      context: row.context,
      route: row.route,
      unit: row.unit,
      frequency: row.frequency,
      evidence_level: row.evidence_level,
      is_human_data: row.is_human_data,
      citation: row.citation ?? [],
      notes: row.notes,
      range_display: rangeText(row),
      low_value: row.low_value,
      high_value: row.high_value,
    };
    const list = refsByCompound.get(row.compound_id) ?? [];
    list.push(ref);
    refsByCompound.set(row.compound_id, list);
  }

  // Group synergies under their compound.
  const synByCompound = new Map<string, CompoundSynergy[]>();
  for (const row of synRows) {
    const list = synByCompound.get(row.compound_id) ?? [];
    list.push({
      id: row.id,
      paired_name: row.paired_name,
      rationale: row.rationale,
      evidence_level: row.evidence_level,
      is_human_data: row.is_human_data,
      caution_notes: row.caution_notes,
    });
    synByCompound.set(row.compound_id, list);
  }

  const referenceCompounds: ReferenceCompound[] = compounds.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    evidence_level: c.evidence_level,
    fda_approved: c.fda_approved,
    mechanism: c.mechanism,
    monitoring_notes: c.monitoring_notes ?? [],
    references: refsByCompound.get(c.id) ?? [],
    synergies: synByCompound.get(c.id) ?? [],
  }));

  // Per-compound reference dose for the calculator picker (prefer a human row,
  // else any numeric row). Lets the calculator be peptide-specific.
  const refDoseByCompound = new Map<string, { low: number; high: number; unit: string }>();
  for (const r of refRows) {
    if (r.low_value === null) continue;
    const existing = refDoseByCompound.get(r.compound_id);
    // First numeric row wins, but a human row upgrades a prior anecdotal one.
    if (!existing || r.is_human_data) {
      refDoseByCompound.set(r.compound_id, {
        low: r.low_value,
        high: r.high_value ?? r.low_value,
        unit: r.unit,
      });
    }
  }

  const compoundOptions = compounds.map((c) => {
    const ref = refDoseByCompound.get(c.id) ?? null;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      is_blend: c.is_blend ?? false,
      typical_vial_mg: c.typical_vial_mg,
      component_mg: c.component_mg ?? [],
      ref_dose: ref, // { low, unit } in the unit the reference uses
    };
  });

  const validTabs = ["reconstitution", "builder", "reference", "titration"] as const;
  const initialTab = (validTabs as readonly string[]).includes(tab ?? "")
    ? (tab as (typeof validTabs)[number])
    : "reconstitution";

  // Open-in-calculator deep link: ?compound=slug auto-selects that peptide so
  // the calculator loads its vial size + reference dose (+ blend composition).
  const initialCompoundId = compoundSlug
    ? (compounds.find((c) => c.slug === compoundSlug)?.id ?? null)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Reconstitution &amp; Protocols</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Step-by-step reconstitution math, a protocol builder, evidence-graded compound reference,
          and titration schedules — all in one place.
        </p>
      </header>

      <Suspense fallback={<div className="text-sm text-[var(--color-muted-foreground)]">Loading…</div>}>
        <ProtocolsHub
          compounds={compoundOptions}
          referenceCompounds={referenceCompounds}
          schedules={schedules}
          initialTab={initialTab}
          initialCompoundId={initialCompoundId}
        />
      </Suspense>

      <SafetyDisclaimer />
    </div>
  );
}
