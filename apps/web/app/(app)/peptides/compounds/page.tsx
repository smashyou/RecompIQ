import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";

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
  const { data } = await supabase
    .from("compounds")
    .select("*")
    .order("name");
  const compounds = (data ?? []) as CompoundRow[];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Compound catalog</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Evidence-graded summaries. No doses listed — those come from you or your clinician.
        </p>
      </header>

      <ul className="space-y-3">
        {compounds.map((c) => (
          <li
            key={c.id}
            className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{c.name}</h2>
                {c.aliases.length > 0 && (
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    aka {c.aliases.join(" · ")}
                  </p>
                )}
              </div>
              <EvidenceBadge
                level={c.evidence_level as never}
                fdaApproved={c.fda_approved}
              />
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">{c.short_description}</p>
            {c.mechanism && (
              <p className="text-xs italic text-[var(--color-muted-foreground)]">
                <span className="not-italic font-medium">Mechanism:</span> {c.mechanism}
              </p>
            )}
            <div className="grid gap-3 text-xs md:grid-cols-3">
              <DetailList title="Absolute contraindications" items={c.absolute_contraindications} />
              <DetailList title="Relative contraindications" items={c.relative_contraindications} />
              <DetailList title="Monitoring" items={c.monitoring_notes} />
            </div>
            {c.common_side_effects.length > 0 && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                <span className="font-medium text-[var(--color-foreground)]">Common side effects:</span>{" "}
                {c.common_side_effects.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      <SafetyDisclaimer />
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-[var(--color-muted-foreground)]">—</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="text-[var(--color-muted-foreground)]">
              • {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
