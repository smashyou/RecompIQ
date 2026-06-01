import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import { evaluateContraindications } from "@peptide/peptides";
import { DoseLogger } from "./logger";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
import { SectionHeader, Overline } from "@/components/kit";

export const dynamic = "force-dynamic";

interface DoseRow {
  id: string;
  taken_at: string;
  dose_value: number;
  dose_unit: string;
  route: string;
  injection_site: string | null;
  adherence: string;
  compounds: { slug: string; name: string; evidence_level: string; fda_approved: boolean } | null;
}

export default async function DoseLogPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [regimen, dosesRes, conditionsRes, medicationsRes] = await Promise.all([
    loadActiveRegimen(user.id),
    supabase
      .from("peptide_doses")
      .select(
        "id,taken_at,dose_value,dose_unit,route,injection_site,adherence, compounds(slug,name,evidence_level,fda_approved)",
      )
      .eq("user_id", user.id)
      .gte("taken_at", fourteenDaysAgo.toISOString())
      .order("taken_at", { ascending: false })
      .limit(60),
    supabase.from("conditions").select("name").eq("user_id", user.id).eq("active", true),
    supabase.from("medications").select("name").eq("user_id", user.id).eq("active", true),
  ]);

  // Quick-loggable items = current regimen items with a decided dose + route.
  const items = (regimen?.currentItems ?? [])
    .filter(
      (i) =>
        i.compound &&
        i.dose_value !== null &&
        i.dose_unit !== null &&
        i.route !== null,
    )
    .map((i) => ({
      id: i.id,
      dose_value: i.dose_value as number,
      dose_unit: i.dose_unit as string,
      route: i.route as string,
      frequency: i.frequency ?? "",
      compound_id: i.compound_id,
      compounds: {
        slug: i.compound!.slug,
        name: i.compound!.name,
        evidence_level: i.compound!.evidence_level,
        fda_approved: i.compound!.fda_approved,
      },
    }));
  const doses = (dosesRes.data ?? []) as unknown as DoseRow[];

  // Contraindication check across the compounds the user is about to log.
  const conditions = (conditionsRes.data ?? []).map((c) => c.name as string);
  const medications = (medicationsRes.data ?? []).map((m) => m.name as string);
  const currentCompounds = new Map(
    (regimen?.currentItems ?? [])
      .map((i) => i.compound)
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => [c.slug, c] as const),
  );
  const findings = Array.from(currentCompounds.values()).flatMap((c) =>
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
    <div>
      <SectionHeader title="Dose log" note="last 14 days" />
      <p className="mb-6 font-[family-name:var(--font-sans)] text-sm leading-[1.55] text-[var(--fg-muted)]">
        Tap a compound from your regimen to log today&apos;s dose at the schedule you set.
      </p>

      {findings.length > 0 && (
        <div className="mb-6">
          <ContraindicationBanner findings={findings} />
        </div>
      )}

      <DoseLogger items={items} />

      <section className="mt-6 space-y-2">
        <Overline>Last 14 days</Overline>
        {doses.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-6 text-center font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
            No doses logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
            {doses.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--fg)]">
                      {d.compounds?.name ?? "Unknown"}
                    </p>
                    {d.compounds && (
                      <EvidenceBadge
                        level={d.compounds.evidence_level as never}
                        fdaApproved={d.compounds.fda_approved}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
                    {new Date(d.taken_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {d.injection_site ? ` · ${d.injection_site}` : ""}
                    {d.adherence !== "taken" ? ` · ${d.adherence}` : ""}
                  </p>
                </div>
                <p className="text-right font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--fg)]">
                  {Number(d.dose_value)} {d.dose_unit}{" "}
                  <span className="text-2xs uppercase text-[var(--fg-subtle)]">{d.route}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}
