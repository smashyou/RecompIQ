import Link from "next/link";
import {
  Beaker,
  Calculator,
  ChevronRight,
  FlaskRound,
  Library,
  Plus,
  Syringe,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
import { Card, SectionHeader, Overline } from "@/components/kit";
import { evaluateContraindications } from "@peptide/peptides";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/peptides/library", label: "Protocol library", icon: Library },
  { href: "/peptides/compounds", label: "Compound catalog", icon: Beaker },
  { href: "/peptides/protocols", label: "Reconstitution & protocols", icon: Calculator },
  { href: "/peptides/dose-log", label: "Dose log", icon: Syringe },
] as const;

export default async function PeptidesPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [regimen, conditionsRes, medicationsRes] = await Promise.all([
    loadActiveRegimen(user.id),
    supabase.from("conditions").select("name").eq("user_id", user.id).eq("active", true),
    supabase.from("medications").select("name").eq("user_id", user.id).eq("active", true),
  ]);

  const phases = regimen?.phases ?? [];
  const conditions = (conditionsRes.data ?? []).map((c) => c.name as string);
  const medications = (medicationsRes.data ?? []).map((m) => m.name as string);

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

      <Link
        href="/peptides/stacks/new"
        className="mb-6 inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-4 py-2.5 font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--primary-bright)] transition-colors hover:bg-[var(--primary-line)]"
      >
        <Plus size={16} /> Add to regimen
      </Link>

      {allFindings.length > 0 && (
        <div className="mb-6">
          <ContraindicationBanner findings={allFindings} />
        </div>
      )}

      {phases.length === 0 ? (
        <Card style={{ borderStyle: "dashed" }}>
          <div className="py-6 text-center">
            <FlaskRound className="mx-auto mb-3 h-8 w-8 text-[var(--fg-subtle)]" />
            <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-muted)]">
              Your regimen is empty. Add the compounds you and your clinician have decided on.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {phases.map((phase) => {
            const isCurrent = phase.ends_on === null;
            return (
              <Card key={phase.id} pad={0}>
                <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] px-[18px] py-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Overline style={{ fontSize: 9 }}>Phase {phase.ordinal}</Overline>
                    <h2 className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
                      {phase.name}
                    </h2>
                    {phase.legacy_phase && (
                      <span className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                        {phase.legacy_phase}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-[var(--r-pill)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--primary-bright)]">
                        current
                      </span>
                    )}
                  </div>
                  <span className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                    {phase.starts_on
                      ? `started ${new Date(phase.starts_on).toLocaleDateString()}`
                      : "not started"}
                  </span>
                </div>
                {phase.items.length === 0 ? (
                  <p className="px-[18px] py-4 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-subtle)]">
                    No compounds in this phase.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {phase.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-[18px] py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/peptides/library/${item.compound!.slug}`}
                              className="font-[family-name:var(--font-sans)] text-[13.5px] font-medium text-[var(--fg)] hover:text-[var(--primary)]"
                            >
                              {item.compound!.name}
                            </Link>
                            <EvidenceBadge
                              level={item.compound!.evidence_level as never}
                              fdaApproved={item.compound!.fda_approved}
                            />
                          </div>
                          <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                            {[item.frequency, item.route, item.notes]
                              .filter(Boolean)
                              .join(" · ") || "schedule not set"}
                          </p>
                        </div>
                        <div className="text-right">
                          {item.dose_value !== null ? (
                            <>
                              <p className="font-[family-name:var(--font-mono)] text-[14px] font-medium tabular-nums text-[var(--fg)]">
                                {item.dose_value}
                                <span className="ml-1 text-[11px] text-[var(--fg-subtle)]">
                                  {item.dose_unit}
                                </span>
                              </p>
                              <Overline style={{ fontSize: 9, letterSpacing: "0.07em" }}>
                                user-supplied
                              </Overline>
                            </>
                          ) : (
                            <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                              dose not set
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}
