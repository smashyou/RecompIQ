import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadInventory } from "@/lib/queries/inventory";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { Card, SectionHeader, Overline, Stat } from "@/components/kit";
import { InventoryManager } from "./inventory-client";

export const dynamic = "force-dynamic";

const usd = (n: number | null) =>
  n === null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number, d = 1) => n.toLocaleString(undefined, { maximumFractionDigits: d });

const PRESETS = [
  { key: "all", label: "All time" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "Year" },
] as const;

function rangeFor(key: string): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (key === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10), to };
  if (key === "90d") return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10), to };
  if (key === "ytd") return { from: `${now.getFullYear()}-01-01`, to };
  return {};
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const { range: rangeKey = "all" } = await searchParams;
  const range = rangeFor(rangeKey);
  const inv = await loadInventory(user.id, range);

  const nameById = new Map(inv.purchases.map((p) => [p.compound_id, p.compound_name]));

  return (
    <div className="mx-auto max-w-[860px]">
      <SectionHeader title="Inventory & expenses" note="cost-per-dose is derived · educational only" />
      <p className="mb-5 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Log vial purchases. RecompIQ derives what each dose costs and what you&apos;ve spent — from
        the numbers you enter. It does not prescribe doses.
      </p>

      {/* range presets */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = p.key === rangeKey;
          return (
            <Link
              key={p.key}
              href={`/peptides/inventory?range=${p.key}`}
              className={`rounded-[var(--r-pill)] border px-3 py-1.5 font-[family-name:var(--font-sans)] text-[12px] font-medium transition-colors ${
                active
                  ? "border-[var(--primary-line)] bg-[var(--primary-wash)] text-[var(--primary-bright)]"
                  : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--fg-muted)] hover:border-[var(--primary-line)]"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      {/* spend summary */}
      <div className="mb-4">
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Spend (range)" value={usd(inv.summary.totalUsd)} />
          <Stat
            label="Weight lost"
            value={inv.weightLostLb && inv.weightLostLb > 0 ? `${num(inv.weightLostLb)} lb` : "—"}
          />
          <Stat label="$ / lb lost" value={usd(inv.summary.costPerLbLostUsd)} />
        </div>
        {inv.summary.byCompound.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <Overline>By compound · weighted avg</Overline>
            <ul className="mt-2 space-y-1.5">
              {inv.summary.byCompound.map((b) => (
                <li key={b.compoundId} className="flex items-center justify-between gap-3 font-[family-name:var(--font-sans)] text-[12.5px]">
                  <span className="text-[var(--fg)]">{nameById.get(b.compoundId) ?? "Unknown"}</span>
                  <span className="flex items-center gap-3">
                    {b.avgCostPerMg !== null && (
                      <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg-subtle)]">
                        {usd(b.avgCostPerMg)}/mg
                      </span>
                    )}
                    <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">
                      {usd(b.spendUsd)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      </div>

      {/* per-compound inventory (FIFO depletion, all-time) */}
      {inv.compounds.length > 0 && (
        <div className="mb-4 space-y-2">
          <Overline>Inventory · what&apos;s left</Overline>
          <div className="grid gap-2 sm:grid-cols-2">
            {inv.compounds.map((c) => (
              <Card key={c.compoundId}>
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-sans)] text-[13.5px] font-medium text-[var(--fg)]">
                    {c.name}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-[var(--fg-subtle)]">
                    {num(c.remainingMg)} mg left
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-[family-name:var(--font-sans)] text-[11.5px]">
                  <Row label="Next dose (FIFO)" value={usd(c.costOfNextDoseUsd)} />
                  <Row label="Avg / dose" value={usd(c.avgCostPerDoseUsd)} />
                  <Row label="Doses left" value={c.remainingDoses !== null ? num(c.remainingDoses, 0) : "—"} />
                  <Row label="Total spent" value={usd(c.totalSpendUsd)} />
                </div>
                {c.doseLabel === null && (
                  <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]">
                    Set a dose on this compound in your regimen for per-dose cost.
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <InventoryManager purchases={inv.purchases} />

      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span className="text-[var(--fg-subtle)]">{label}</span>
      <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--fg)]">{value}</span>
    </span>
  );
}
