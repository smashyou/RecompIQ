import Link from "next/link";
import { Beaker, Calculator, ChevronRight, Library, Syringe, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
import { SectionHeader } from "@/components/kit";
import { RegimenBoard, type BoardPhase } from "@/components/regimen/regimen-board";
import { evaluateContraindications } from "@peptide/peptides";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/peptides/library", label: "Protocol library", icon: Library },
  { href: "/peptides/compounds", label: "Compound catalog", icon: Beaker },
  { href: "/peptides/protocols", label: "Reconstitution & protocols", icon: Calculator },
  { href: "/peptides/dose-log", label: "Dose log", icon: Syringe },
  { href: "/peptides/inventory", label: "Inventory & spend", icon: Wallet },
] as const;

export default async function PeptidesPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [regimen, conditionsRes, medicationsRes] = await Promise.all([
    loadActiveRegimen(user.id),
    supabase.from("conditions").select("name").eq("user_id", user.id).eq("active", true),
    supabase.from("medications").select("name").eq("user_id", user.id).eq("active", true),
  ]);

  const conditions = (conditionsRes.data ?? []).map((c) => c.name as string);
  const medications = (medicationsRes.data ?? []).map((m) => m.name as string);

  const phases: BoardPhase[] = (regimen?.phases ?? []).map((p) => ({
    id: p.id,
    ordinal: p.ordinal,
    name: p.name,
    legacy_phase: p.legacy_phase,
    starts_on: p.starts_on,
    ends_on: p.ends_on,
    items: p.items.map((i) => ({
      id: i.id,
      compound_id: i.compound_id,
      compound_slug: i.compound?.slug ?? "",
      compound_name: i.compound?.name ?? "Unknown",
      evidence_level: i.compound?.evidence_level ?? "ANECDOTAL",
      fda_approved: i.compound?.fda_approved ?? false,
      dose_value: i.dose_value,
      dose_unit: i.dose_unit,
      route: i.route,
      frequency: i.frequency,
      starts_on: i.starts_on,
      notes: i.notes,
    })),
  }));

  // Compute contraindications across the compounds the user is currently on.
  const currentCompounds = new Map(
    (regimen?.currentItems ?? [])
      .map((i) => i.compound)
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => [c.slug, c] as const),
  );
  const allFindings = Array.from(currentCompounds.values()).flatMap((c) =>
    evaluateContraindications(
      {
        slug: c.slug,
        name: c.name,
        absolute_contraindications: c.absolute_contraindications ?? [],
        relative_contraindications: c.relative_contraindications ?? [],
      },
      { conditions, medications, age: null },
    ),
  );

  return (
    <div className="mx-auto max-w-[860px]">
      <SectionHeader
        num="07"
        title="Peptides"
        note="educational tracking · not prescriptive"
      />

      <p className="mb-5 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Your living regimen, phased over time. Track the compounds and doses you or your clinician
        have decided on. RecompIQ grades the evidence and flags contraindications — it does not
        prescribe.
      </p>

      {/* nav tiles */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-[14px] transition-colors hover:border-[var(--primary-line)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
              <Icon size={17} />
            </span>
            <span className="flex-1 font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
              {label}
            </span>
            <ChevronRight
              size={16}
              className="text-[var(--fg-subtle)] transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>

      {allFindings.length > 0 && (
        <div className="mb-6">
          <ContraindicationBanner findings={allFindings} />
        </div>
      )}

      <RegimenBoard phases={phases} conditions={conditions} medications={medications} />

      <div className="mt-6">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}
