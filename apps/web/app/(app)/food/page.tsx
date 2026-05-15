import Link from "next/link";
import { Plus, Utensils } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface FoodLogRow {
  id: string;
  description: string;
  brand: string | null;
  amount: number;
  unit: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_type: string | null;
  logged_at: string;
}

const MEAL_ORDER: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

export default async function FoodPage() {
  const user = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();

  const [logsRes, goalRes] = await Promise.all([
    supabase
      .from("food_logs")
      .select("id,description,brand,amount,unit,calories_kcal,protein_g,carbs_g,fat_g,meal_type,logged_at")
      .eq("user_id", user.id)
      .gte("logged_at", `${today}T00:00:00`)
      .lte("logged_at", `${today}T23:59:59.999`)
      .order("logged_at", { ascending: true }),
    supabase
      .from("goals")
      .select("protein_target_g_min,protein_target_g_max")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const logs = (logsRes.data ?? []) as FoodLogRow[];
  const goal = goalRes.data;

  const totals = logs.reduce(
    (a, r) => ({
      cal: a.cal + Number(r.calories_kcal),
      p: a.p + Number(r.protein_g),
      c: a.c + Number(r.carbs_g),
      f: a.f + Number(r.fat_g),
    }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );

  const grouped = new Map<string, FoodLogRow[]>();
  for (const log of logs) {
    const key = log.meal_type ?? "other";
    const arr = grouped.get(key) ?? [];
    arr.push(log);
    grouped.set(key, arr);
  }
  const groups = Array.from(grouped.entries()).sort(
    ([a], [b]) => (MEAL_ORDER[a] ?? 99) - (MEAL_ORDER[b] ?? 99),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Food</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            What you ate today. Add anything, even rough estimates — patterns matter.
          </p>
        </div>
        <Button asChild>
          <Link href="/food/log">
            <Plus className="h-4 w-4" />
            Add meal
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Calories" value={totals.cal} unit="kcal" />
        <Stat
          label="Protein"
          value={totals.p}
          unit="g"
          target={goal ? `${goal.protein_target_g_min}–${goal.protein_target_g_max}` : null}
        />
        <Stat label="Carbs" value={totals.c} unit="g" />
        <Stat label="Fat" value={totals.f} unit="g" />
      </section>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <Utensils className="mx-auto mb-3 h-8 w-8 text-[var(--color-muted-foreground)]" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Nothing logged today. Add your first meal to start filling the macros card.
          </p>
        </div>
      ) : (
        <section className="space-y-6">
          {groups.map(([mealType, items]) => (
            <div key={mealType} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
                {mealType === "other" ? "Other" : mealType}
              </h2>
              <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
                {items.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{log.description}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {log.brand ? `${log.brand} · ` : ""}
                        {Number(log.amount)} {log.unit}
                      </p>
                    </div>
                    <div className="text-right text-xs tabular-nums text-[var(--color-muted-foreground)]">
                      <p className="text-[var(--color-foreground)]">
                        {Math.round(Number(log.calories_kcal))} kcal
                      </p>
                      <p>
                        P {Math.round(Number(log.protein_g))}g · C{" "}
                        {Math.round(Number(log.carbs_g))}g · F{" "}
                        {Math.round(Number(log.fat_g))}g
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  target,
}: {
  label: string;
  value: number;
  unit: string;
  target?: string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {Math.round(value)}
        <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">{unit}</span>
      </p>
      {target && (
        <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          target {target}
        </p>
      )}
    </div>
  );
}
