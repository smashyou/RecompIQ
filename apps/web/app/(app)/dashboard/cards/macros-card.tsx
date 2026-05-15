import type { DashboardSnapshot } from "@/lib/queries/dashboard";
import { Card, Empty } from "./card";

interface MacrosToday {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function MacrosCard({
  snapshot,
  macros,
}: {
  snapshot: DashboardSnapshot;
  macros: MacrosToday;
}) {
  const total =
    Math.round(macros.calories_kcal) +
    Math.round(macros.protein_g) +
    Math.round(macros.carbs_g) +
    Math.round(macros.fat_g);

  if (total === 0) {
    return (
      <Card title="Today's macros">
        <Empty>No food logged today. Add a meal in /food.</Empty>
      </Card>
    );
  }

  const proteinMin = snapshot.goal?.protein_target_g_min ?? null;
  const proteinMax = snapshot.goal?.protein_target_g_max ?? null;
  const proteinPct =
    proteinMax && proteinMax > 0
      ? Math.min(100, Math.round((macros.protein_g / proteinMax) * 100))
      : null;

  return (
    <Card title="Today's macros" hint="from food logs">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-3xl font-semibold tabular-nums">
            {Math.round(macros.calories_kcal)}
            <span className="ml-1 text-sm font-normal text-[var(--color-muted-foreground)]">
              kcal
            </span>
          </p>
          {proteinPct !== null && (
            <p className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
              Protein {proteinPct}%
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-xs">
          <MacroStat
            label="Protein"
            value={macros.protein_g}
            target={proteinMin !== null ? `${proteinMin}-${proteinMax}` : null}
          />
          <MacroStat label="Carbs" value={macros.carbs_g} />
          <MacroStat label="Fat" value={macros.fat_g} />
        </dl>
        {proteinPct !== null && proteinMin !== null && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div
              className="h-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${Math.min(100, (macros.protein_g / (proteinMin || 1)) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function MacroStat({
  label,
  value,
  target,
}: {
  label: string;
  value: number;
  target?: string | null;
}) {
  return (
    <div>
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="tabular-nums">{Math.round(value)} g</dd>
      {target && (
        <p className="mt-0.5 text-[10px] text-[var(--color-muted-foreground)]">target {target}</p>
      )}
    </div>
  );
}
