import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FlaskRound, Shield } from "lucide-react";
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
    component_mg: (compound.component_mg ?? []) as { label: string; mg: number | null }[],
    typical_vial_mg: compound.typical_vial_mg ?? null,
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

  // Header stat boxes — Route / Dose range / Frequency / Evidence (mirrors the
  // reference's Route / Half-life / Cadence trio, wired to real data).
  const stats = [
    { label: "Route", value: routeLabel(compound.typical_route) },
    { label: "Dose range", value: repRange },
    { label: "Frequency", value: freq },
    { label: "Evidence", value: compound.evidence_level.replace(/_/g, " ").toLowerCase() },
  ];

  const subtitle = [categoryLabel(compound.category), ...(compound.aliases?.slice(0, 4) ?? [])]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <Link
        href="/peptides/library"
        className="mb-[18px] inline-flex items-center gap-1.5 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ChevronRight className="h-[15px] w-[15px] rotate-180" /> All compounds
      </Link>

      {/* header — icon + display-font name + evidence badge + category/aka */}
      <div className="mb-[18px] flex items-start gap-4">
        <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
          <FlaskRound size={26} />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[-0.02em] text-[var(--fg)]">
              {compound.name}
            </h1>
            <EvidenceBadge
              level={compound.evidence_level as EvidenceLevel}
              fdaApproved={compound.fda_approved}
            />
          </div>
          {subtitle && (
            <p className="mt-1 font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
              {subtitle}
            </p>
          )}
          {/* stat boxes — Route / Dose range / Frequency / Evidence */}
          <div className="mt-4 grid grid-cols-2 gap-[var(--space-grid)] sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <span className="font-[family-name:var(--font-sans)] text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                  {s.label}
                </span>
                <div className="mt-1 font-[family-name:var(--font-mono)] text-base capitalize tabular-nums text-[var(--fg)]">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* clinician prompt strip */}
      <div className="mb-[18px] flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-4 py-3">
        <Shield size={18} className="shrink-0 text-[var(--primary)]" />
        <span className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg)]">
          Discuss this compound and any protocol with a licensed clinician before starting or
          changing.
        </span>
      </div>

      <CompoundTabs detail={detail} />

      <div className="mt-[var(--space-grid)]">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}
