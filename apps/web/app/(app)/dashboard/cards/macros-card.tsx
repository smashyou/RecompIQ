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
  const logged =
    Math.round(macros.calories_kcal) +
    Math.round(macros.protein_g) +
    Math.round(macros.carbs_g) +
    Math.round(macros.fat_g);

  const energy = snapshot.energy;
  const targets = snapshot.macroTargets;

  if (logged === 0) {
    return (
      <Card title="Today's macros">
        <Empty>
          No food logged today. Add a meal in /food.
          {energy && (
            <>
              {" "}
              Your budget is about {Math.round(energy.lowKcal)}–{Math.round(energy.highKcal)} kcal.
            </>
          )}
        </Empty>
      </Card>
    );
  }

  const kcal = Math.round(macros.calories_kcal);
  const remaining = energy ? Math.round(energy.targetKcal) - kcal : null;

  return (
    <Card title="Today's macros" hint="from food logs">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-stat font-semibold tabular-nums">
            {kcal}
            {energy && (
              <span className="text-sm font-normal text-[var(--color-muted-foreground)]">
                {" / "}
                {Math.round(energy.targetKcal)}
              </span>
            )}
            <span className="ml-1 text-sm font-normal text-[var(--color-muted-foreground)]">
              kcal
            </span>
          </p>
          {remaining !== null && (
            <p className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
              {remaining >= 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
            </p>
          )}
        </div>

        {energy && <Meter value={kcal} target={energy.targetKcal} />}

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <MacroStat
            label="Protein"
            value={macros.protein_g}
            target={targets ? `${Math.round(targets.proteinGMin)}-${Math.round(targets.proteinGMax)}` : null}
          />
          <MacroStat
            label="Carbs"
            value={macros.carbs_g}
            target={targets ? `${Math.round(targets.carbGMin)}-${Math.round(targets.carbGMax)}` : null}
          />
          <MacroStat
            label="Fat"
            value={macros.fat_g}
            target={targets ? `${Math.round(targets.fatGMin)}-${Math.round(targets.fatGMax)}` : null}
          />
        </dl>

        {energy ? <Basis energy={energy} /> : <MissingBasis snapshot={snapshot} />}
      </div>
    </Card>
  );
}

/**
 * Fills to the target, then keeps rendering past it in a warning tone. Both the
 * bar and any percentage must divide by the SAME number — an earlier version
 * showed a percentage against the protein max while the bar underneath used the
 * min, so the two disagreed on the same row.
 */
function Meter({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? (value / target) * 100 : 0;
  const over = pct > 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
      <div
        className={`h-full transition-all ${over ? "bg-[var(--color-destructive)]" : "bg-[var(--color-accent)]"}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

/**
 * Says where the number came from. A calorie target is an estimate built on a
 * population regression, so the user should be able to see its basis and judge
 * it — particularly whether the activity factor was measured or assumed.
 */
function Basis({ energy }: { energy: NonNullable<DashboardSnapshot["energy"]> }) {
  const equation = energy.bmrBasis === "katch-mcardle" ? "Katch-McArdle" : "Mifflin-St Jeor";
  return (
    <div className="space-y-1 border-t border-[var(--color-border)] pt-2 text-2xs text-[var(--color-muted-foreground)]">
      <p>
        {Math.round(energy.bmrKcal)} kcal resting ({equation}) × {energy.activityFactor} (
        {energy.activityLabel}
        {energy.activityMeasured ? ", from your steps" : ", assumed — log steps to refine"}) ={" "}
        {Math.round(energy.tdeeKcal)} maintenance, minus {Math.round(energy.deficitKcal)} for{" "}
        {energy.achievableLbPerWeek.toFixed(1)} lb/week.
      </p>
      {energy.rateCapped && <p>Rate {energy.rateCapReason}.</p>}
      {energy.floored && (
        <p className="font-medium">
          Your goal timeline would need eating below your resting burn, so the target is held at
          resting. At this activity level the timeline supports about{" "}
          {energy.achievableLbPerWeek.toFixed(1)} lb/week — worth extending the timeline, raising
          activity, or discussing with your clinician.
        </p>
      )}
      <p>Estimate for education, not medical advice. Discuss targets with your clinician.</p>
    </div>
  );
}

/** Names the exact missing field instead of silently showing no target. */
function MissingBasis({ snapshot }: { snapshot: DashboardSnapshot }) {
  const missing: string[] = [];
  if (!snapshot.goal) missing.push("a goal");
  if (!snapshot.latestWeight) missing.push("a weigh-in");
  if (missing.length === 0) missing.push("your height, date of birth and sex in Settings");
  return (
    <p className="border-t border-[var(--color-border)] pt-2 text-2xs text-[var(--color-muted-foreground)]">
      No calorie target yet — add {missing.join(" and ")}. A body-fat reading from a smart scale
      also works in place of sex and height.
    </p>
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
        <p className="mt-0.5 text-2xs text-[var(--color-muted-foreground)]">target {target}</p>
      )}
    </div>
  );
}
