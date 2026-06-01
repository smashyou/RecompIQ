import { requireUser } from "@/lib/auth";
import { loadTimeline } from "@/lib/queries/timeline";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";
import { TimelineClient } from "./timeline-client";

export const dynamic = "force-dynamic";

const PRESETS = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "Year" },
  { key: "all", label: "All time" },
] as const;

function rangeFor(key: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (key === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10), to };
  if (key === "ytd") return { from: `${now.getFullYear()}-01-01`, to };
  if (key === "all") return { from: "2020-01-01", to };
  // default 90d
  return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10), to };
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range: rangeKey = "90d" } = await searchParams;
  const range = rangeFor(rangeKey);
  const data = await loadTimeline(user.id, range);

  return (
    <div>
      <SectionHeader title="Timeline" note="everything, one date range · read-only" />
      <p className="mb-4 font-[family-name:var(--font-sans)] text-sm leading-[1.55] text-[var(--fg-muted)]">
        Every stream you track — doses, peptides, food, training, weight, goal metrics, labs, and
        spend — over the same dates. Scrub across to read any day. This is a view of what you logged;
        it does not interpret results or prescribe.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = p.key === rangeKey || (rangeKey === "90d" && p.key === "90d");
          return (
            <a
              key={p.key}
              href={`/timeline?range=${p.key}`}
              className={`rounded-[var(--r-pill)] border px-3 py-1.5 font-[family-name:var(--font-sans)] text-xs font-medium transition-colors ${
                active
                  ? "border-[var(--primary-line)] bg-[var(--primary-wash)] text-[var(--primary-bright)]"
                  : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--primary-line)]"
              }`}
            >
              {p.label}
            </a>
          );
        })}
      </div>

      <TimelineClient data={data} />

      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}
