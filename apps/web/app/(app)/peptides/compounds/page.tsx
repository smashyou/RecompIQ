import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader, Overline } from "@/components/kit";

export const dynamic = "force-dynamic";

interface CompoundRow {
  id: string;
  slug: string;
  name: string;
  aliases: string[];
  category: string;
  evidence_level: string;
  fda_approved: boolean;
  short_description: string;
  mechanism: string | null;
  typical_route: string | null;
  monitoring_notes: string[];
  absolute_contraindications: string[];
  relative_contraindications: string[];
  common_side_effects: string[];
}

export default async function CompoundsPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("compounds").select("*").order("name");
  const compounds = (data ?? []) as CompoundRow[];

  return (
    <div className="mx-auto max-w-[980px]">
      <SectionHeader
        title="Compound catalog"
        note={`${compounds.length} compounds`}
      />

      <p className="mb-6 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Evidence-graded summaries sourced from public literature. No doses listed here — those come
        from you or your clinician.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {compounds.map((c) => (
          <Link
            key={c.id}
            href={`/peptides/library/${c.slug}`}
            className="group flex flex-col rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] p-[18px] transition-colors hover:border-[var(--primary-line)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[-0.01em] text-[var(--fg)] group-hover:text-[var(--primary)]">
                  {c.name}
                </h2>
                {c.aliases.length > 0 && (
                  <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                    aka {c.aliases.join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <EvidenceBadge level={c.evidence_level as never} fdaApproved={c.fda_approved} />
                <ChevronRight
                  size={16}
                  className="text-[var(--fg-subtle)] transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </div>

            <p className="mt-3 font-[family-name:var(--font-sans)] text-[12.5px] leading-[1.5] text-[var(--fg-muted)]">
              {c.short_description}
            </p>

            {c.mechanism && (
              <p className="mt-2 font-[family-name:var(--font-sans)] text-[11.5px] leading-[1.5] text-[var(--fg-subtle)]">
                <span className="font-medium text-[var(--fg-muted)]">Mechanism</span> · {c.mechanism}
              </p>
            )}

            <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-3">
              <DetailList title="Absolute contra." items={c.absolute_contraindications} />
              <DetailList title="Relative contra." items={c.relative_contraindications} />
              <DetailList title="Monitoring" items={c.monitoring_notes} />
            </div>

            {c.common_side_effects.length > 0 && (
              <p className="mt-3 font-[family-name:var(--font-sans)] text-[11.5px] leading-[1.5] text-[var(--fg-subtle)]">
                <span className="font-medium text-[var(--fg-muted)]">Common side effects</span> ·{" "}
                {c.common_side_effects.join(", ")}
              </p>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <Overline style={{ fontSize: 9, letterSpacing: "0.08em" }}>{title}</Overline>
      {items.length === 0 ? (
        <p className="mt-1 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
          —
        </p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {items.map((it, i) => (
            <li
              key={i}
              className="font-[family-name:var(--font-sans)] text-[11.5px] leading-[1.45] text-[var(--fg-muted)]"
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
