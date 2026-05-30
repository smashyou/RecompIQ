import { Suspense } from "react";
import { wrapDoseLike } from "@peptide/peptides";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
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
  const u = row.unit;
  let core: string;
  if (row.low_value !== null && row.high_value !== null) {
    core =
      row.low_value === row.high_value
        ? `${row.low_value} ${u}`
        : `${row.low_value}–${row.high_value} ${u}`;
  } else if (row.low_value !== null) {
    core = `from ${row.low_value} ${u}`;
  } else if (row.high_value !== null) {
    core = `up to ${row.high_value} ${u}`;
  } else {
    core = "range not established";
  }
  return row.frequency ? `${core}, ${row.frequency}` : core;
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
      .select("id,slug,name,evidence_level,fda_approved,mechanism,monitoring_notes")
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
    const { wrappedText } = wrapDoseLike(rangeText(row));
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
      range_display: wrappedText,
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

  const compoundOptions = compounds.map((c) => ({ id: c.id, name: c.name }));

  const validTabs = ["reconstitution", "builder", "reference", "titration"] as const;
  const initialTab = (validTabs as readonly string[]).includes(tab ?? "")
    ? (tab as (typeof validTabs)[number])
    : "reconstitution";

  // Open-in-calculator deep link: ?compound=slug prefills the lowest human-data
  // reference dose (educational starting point; user overrides freely).
  let initialPrefill: { doseMg?: number; doseUnit?: string } | null = null;
  if (compoundSlug) {
    const target = compounds.find((c) => c.slug === compoundSlug);
    if (target) {
      const rows = refRows
        .filter((r) => r.compound_id === target.id && r.low_value !== null && r.is_human_data)
        .filter((r) => r.unit === "mg" || r.unit === "mcg");
      if (rows.length > 0) {
        const r = rows[0]!;
        initialPrefill = {
          doseMg: r.unit === "mcg" ? (r.low_value as number) / 1000 : (r.low_value as number),
          doseUnit: r.unit === "mcg" ? "mcg" : "mg",
        };
      }
    }
  }

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
          initialPrefill={initialPrefill}
        />
      </Suspense>

      <SafetyDisclaimer />
    </div>
  );
}
