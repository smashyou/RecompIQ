import Link from "next/link";
import { Plus, Utensils } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, MetricBox } from "@/components/kit";

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
const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};

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

  const proteinTarget = goal
    ? `target ${goal.protein_target_g_min}–${goal.protein_target_g_max} g`
    : null;

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
    <div className="flex w-full flex-col gap-[var(--space-grid)]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em] text-foreground">
            Food
          </h1>
          <p className="mt-1 font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
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

      <Card title="Today's macros" hint={today}>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricBox label="Protein" value={Math.round(totals.p)} unit="g" />
          <MetricBox label="Carbs" value={Math.round(totals.c)} unit="g" />
          <MetricBox label="Fat" value={Math.round(totals.f)} unit="g" />
          <MetricBox label="Calories" value={Math.round(totals.cal)} unit="kcal" />
        </div>
        {proteinTarget && (
          <p className="mt-3 font-[family-name:var(--font-sans)] text-2xs uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
            Protein {proteinTarget}
          </p>
        )}
      </Card>

      {logs.length === 0 ? (
        <div
          className="rounded-[var(--r-lg)] border border-dashed border-border p-10 text-center"
          style={{ background: "var(--surface-1)" }}
        >
          <Utensils className="mx-auto mb-3 h-8 w-8 text-[var(--fg-subtle)]" />
          <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
            Nothing logged today. Add your first meal to start filling the macros card.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--space-grid)]">
          {groups.map(([mealType, items]) => {
            const mealCal = items.reduce((s, r) => s + Number(r.calories_kcal), 0);
            return (
              <Card
                key={mealType}
                title={MEAL_LABEL[mealType] ?? "Other"}
                hint={`${Math.round(mealCal)} kcal`}
                pad={0}
              >
                <ul className="divide-y divide-[var(--border)]">
                  {items.map((log) => (
                    <li key={log.id} className="flex items-center justify-between gap-3 px-[18px] py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-[family-name:var(--font-sans)] text-sm font-medium text-foreground">
                          {log.description}
                        </p>
                        <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
                          {log.brand ? `${log.brand} · ` : ""}
                          <span className="font-[family-name:var(--font-mono)] tabular-nums">
                            {Number(log.amount)}
                          </span>{" "}
                          {log.unit}
                        </p>
                      </div>
                      <div className="text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--fg-subtle)]">
                        <p className="text-foreground">{Math.round(Number(log.calories_kcal))} kcal</p>
                        <p>
                          P {Math.round(Number(log.protein_g))}g · C {Math.round(Number(log.carbs_g))}g · F{" "}
                          {Math.round(Number(log.fat_g))}g
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
