import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import {
  doseRangeWrapped,
  representativeRange,
  commonFrequency,
  routeLabel,
  categoryLabel,
  type DoseRefLike,
} from "@/lib/dose-display";
import { CompoundTabs, type CompoundDetail } from "./compound-tabs";
import type { EvidenceLevel } from "@peptide/shared";

export const dynamic = "force-dynamic";

interface Citation {
  source?: string;
  title?: string;
  url?: string;
  year?: number;
}

export default async function CompoundDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: compound } = await supabase
    .from("compounds")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!compound) notFound();

  const [refsRes, synRes] = await Promise.all([
    supabase.from("compound_dose_reference").select("*").eq("compound_id", compound.id).order("context"),
    supabase
      .from("compound_synergies")
      .select("*")
      .eq("compound_id", compound.id)
      .order("paired_name"),
  ]);

  // For blends, load the component compounds so we can show them + the UNION of
  // their cautions, plus each component's dose ranges for the Dosing tab.
  const componentSlugs: string[] = compound.component_slugs ?? [];
  let components: CompoundDetail["components"] = [];
  let componentDosing: CompoundDetail["componentDosing"] = [];
  if (compound.is_blend && componentSlugs.length > 0) {
    const { data: comps } = await supabase
      .from("compounds")
      .select("id,slug,name,evidence_level,fda_approved,typical_route,absolute_contraindications,relative_contraindications")
      .in("slug", componentSlugs);
    const compList = comps ?? [];
    components = compList.map((c) => ({
      slug: c.slug,
      name: c.name,
      evidence_level: c.evidence_level,
      fda_approved: c.fda_approved,
      absolute_contraindications: c.absolute_contraindications ?? [],
      relative_contraindications: c.relative_contraindications ?? [],
    }));

    const compIds = compList.map((c) => c.id);
    const { data: compRefs } = compIds.length
      ? await supabase
          .from("compound_dose_reference")
          .select("compound_id, context, route, low_value, high_value, unit, frequency, evidence_level, is_human_data")
          .in("compound_id", compIds)
      : { data: [] };
    const refsByComp = new Map<string, DoseRefLike[]>();
    for (const r of (compRefs ?? []) as (DoseRefLike & { compound_id: string })[]) {
      const list = refsByComp.get(r.compound_id) ?? [];
      list.push(r);
      refsByComp.set(r.compound_id, list);
    }
    // Order components by the blend's declared order; one representative line each.
    componentDosing = compList
      .map((c) => {
        const rows = (refsByComp.get(c.id) ?? []).filter((r) => r.low_value !== null);
        // Prefer a human row, else the community/anecdotal one.
        const pick = rows.find((r) => r.is_human_data) ?? rows[0];
        if (!pick) return null;
        return {
          slug: c.slug,
          name: c.name,
          range_display: doseRangeWrapped(pick),
          route: pick.route,
          evidence_level: pick.evidence_level,
          is_human_data: pick.is_human_data,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  const refRows = (refsRes.data ?? []) as (DoseRefLike & {
    id: string;
    citation: Citation[] | null;
    notes: string | null;
  })[];
  const synRows = (synRes.data ?? []) as {
    id: string;
    paired_name: string;
    rationale: string;
    evidence_level: string;
    is_human_data: boolean;
    caution_notes: string | null;
    citation: Citation[] | null;
  }[];

  // Header stats
  const repRange = representativeRange(refRows);
  const freq = commonFrequency(refRows);

  // Dosing protocol cards — wrap each range so the [edu] badge attaches client-side.
  const protocols = refRows.map((r) => ({
    id: r.id,
    context: r.context,
    route: r.route,
    evidence_level: r.evidence_level,
    is_human_data: r.is_human_data,
    notes: r.notes,
    range_display: doseRangeWrapped(r),
  }));

  // Aggregate + dedupe citations for the Research tab.
  const seen = new Set<string>();
  const references: Citation[] = [];
  const pushCite = (c: Citation) => {
    const key = (c.url ?? c.title ?? "").toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    references.push(c);
  };
  for (const c of (compound.citations ?? []) as Citation[]) pushCite(c);
  for (const r of refRows) for (const c of r.citation ?? []) pushCite(c);
  for (const s of synRows) for (const c of s.citation ?? []) pushCite(c);

  const detail: CompoundDetail = {
    slug: compound.slug,
    name: compound.name,
    aliases: compound.aliases ?? [],
    category: compound.category,
    evidence_level: compound.evidence_level,
    fda_approved: compound.fda_approved,
    short_description: compound.short_description,
    mechanism: compound.mechanism,
    typical_route: compound.typical_route,
    is_blend: compound.is_blend ?? false,
    components,
    componentDosing,
    monitoring_notes: compound.monitoring_notes ?? [],
    absolute_contraindications: compound.absolute_contraindications ?? [],
    relative_contraindications: compound.relative_contraindications ?? [],
    common_side_effects: compound.common_side_effects ?? [],
    serious_adverse_events: compound.serious_adverse_events ?? [],
    protocols,
    synergies: synRows.map((s) => ({
      id: s.id,
      paired_name: s.paired_name,
      rationale: s.rationale,
      evidence_level: s.evidence_level,
      is_human_data: s.is_human_data,
      caution_notes: s.caution_notes,
    })),
    references,
    representativeDose: repRange,
    frequency: freq,
  };

  const stats = [
    { label: "Route", value: routeLabel(compound.typical_route) },
    { label: "Dose range", value: repRange },
    { label: "Frequency", value: freq },
    { label: "Evidence", value: compound.evidence_level.replace(/_/g, " ").toLowerCase() },
    { label: "FDA", value: compound.fda_approved ? "approved" : "not approved" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/peptides/library"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" /> All compounds
      </Link>

      {/* Header card */}
      <header className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[var(--color-muted)] p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--color-primary)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary-foreground)]">
            {categoryLabel(compound.category)}
          </span>
          {compound.typical_route && (
            <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs uppercase text-[var(--color-muted-foreground)]">
              {compound.typical_route}
            </span>
          )}
          <EvidenceBadge level={compound.evidence_level as EvidenceLevel} fdaApproved={compound.fda_approved} />
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{compound.name}</h1>
        {compound.aliases?.length > 0 && (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {compound.aliases.slice(0, 4).join(" · ")}
          </p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/60 p-3 text-center">
              <div className="text-sm font-semibold capitalize tabular-nums">{s.value}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </header>

      <CompoundTabs detail={detail} />

      <SafetyDisclaimer />
    </div>
  );
}
