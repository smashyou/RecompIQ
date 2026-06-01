"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { Card, MetricBox } from "@/components/kit";

interface NutritionFacts {
  source: string;
  sourceId: string;
  description: string;
  brand: string | null;
  basis: "per_100g" | "per_serving";
  servingSizeG: number | null;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
}

const UNITS = ["g", "oz", "serving"] as const;
type Unit = (typeof UNITS)[number];

const G_PER_OZ = 28.3495;

function gramsFor(food: NutritionFacts, amount: number, unit: Unit): number | null {
  if (unit === "g") return amount;
  if (unit === "oz") return amount * G_PER_OZ;
  if (unit === "serving" && food.servingSizeG && food.servingSizeG > 0)
    return amount * food.servingSizeG;
  return null;
}

function computeMacros(food: NutritionFacts, amount: number, unit: Unit) {
  const grams = gramsFor(food, amount, unit);
  if (grams === null) return null;
  let scale: number;
  if (food.basis === "per_100g") scale = grams / 100;
  else if (unit === "serving") scale = amount;
  else if (food.servingSizeG && food.servingSizeG > 0) scale = grams / food.servingSizeG;
  else return null;
  return {
    calories_kcal: +(food.caloriesKcal * scale).toFixed(1),
    protein_g: +(food.proteinG * scale).toFixed(1),
    carbs_g: +(food.carbsG * scale).toFixed(1),
    fat_g: +(food.fatG * scale).toFixed(1),
    fiber_g: food.fiberG !== null ? +(food.fiberG * scale).toFixed(1) : null,
    sugar_g: food.sugarG !== null ? +(food.sugarG * scale).toFixed(1) : null,
    sodium_mg: food.sodiumMg !== null ? +(food.sodiumMg * scale).toFixed(0) : null,
  };
}

export function FoodLogger() {
  const router = useRouter();
  const toast = useFireToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NutritionFacts[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NutritionFacts | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.status === 401) {
          router.replace("/signin?next=/food/log");
          return;
        }
        const body = (await res.json()) as {
          data?: { results: NutritionFacts[] };
          error?: { message: string };
        };
        if (!res.ok) {
          setSearchError(body.error?.message ?? "Search failed");
          setResults([]);
        } else {
          setResults(body.data?.results ?? []);
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setSearchError("Network error");
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [query, router]);

  if (selected) {
    return (
      <PortionForm
        food={selected}
        onCancel={() => setSelected(null)}
        onSaved={() => {
          toast.success(`Logged: ${selected.description}`);
          router.replace("/food");
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" />
        <Input
          type="search"
          autoFocus
          placeholder='e.g. "chicken breast" or "Chobani Greek yogurt"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching && (
        <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
          Searching…
        </p>
      )}
      {searchError && (
        <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--danger)]">
          {searchError}
        </p>
      )}

      {results.length > 0 && (
        <ul
          className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--r-lg)] border border-border"
          style={{ background: "var(--surface-1)" }}
        >
          {results.map((r) => (
            <li key={`${r.source}:${r.sourceId}`}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="flex w-full items-center justify-between gap-3 px-[18px] py-3.5 text-left transition-colors hover:bg-[var(--surface-2)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[family-name:var(--font-sans)] text-sm font-medium text-foreground">
                    {r.description}
                  </p>
                  <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
                    {r.brand ? `${r.brand} · ` : ""}
                    <span className="uppercase tracking-[0.08em]">{r.source}</span>
                  </p>
                </div>
                <div className="text-right font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--fg-subtle)]">
                  <p className="text-foreground">{Math.round(r.caloriesKcal)} kcal</p>
                  <p>per {r.basis === "per_100g" ? "100 g" : `${r.servingSizeG ?? "?"} g`}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && query.trim() && results.length === 0 && !searchError && (
        <p
          className="rounded-[var(--r-lg)] border border-dashed border-border p-6 text-center font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]"
          style={{ background: "var(--surface-1)" }}
        >
          No results. Try a simpler term, or check spelling. USDA search is rate-limited without
          a key — add USDA_FDC_API_KEY to .env.local for higher throughput.
        </p>
      )}
    </div>
  );
}

function PortionForm({
  food,
  onCancel,
  onSaved,
}: {
  food: NutritionFacts;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useFireToast();
  const router = useRouter();
  const defaultUnit: Unit = food.servingSizeG ? "serving" : "g";
  const defaultAmount = food.servingSizeG ? 1 : 100;
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [mealType, setMealType] = useState<string>(guessMealType());
  const [submitting, setSubmitting] = useState(false);

  const macros = useMemo(() => computeMacros(food, amount, unit), [food, amount, unit]);

  async function save() {
    if (!macros) {
      toast.error("Pick a unit that has a known conversion for this food.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/food/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: food.description,
        brand: food.brand,
        source: food.source,
        source_id: food.sourceId,
        amount,
        unit,
        meal_type: mealType || null,
        ...macros,
      }),
    });
    setSubmitting(false);
    if (res.status === 401) {
      router.replace("/signin?next=/food/log");
      return;
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Could not save meal");
      return;
    }
    onSaved();
  }

  return (
    <Card pad={24} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="space-y-1">
        <p className="font-[family-name:var(--font-sans)] text-2xs uppercase tracking-[0.16em] text-[var(--fg-subtle)]">
          {food.source}
          {food.brand ? ` · ${food.brand}` : ""}
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.01em] text-foreground">
          {food.description}
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.1"
            min={0}
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.valueAsNumber || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <select
            id="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as Unit)}
            className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            {UNITS.map((u) => (
              <option
                key={u}
                value={u}
                disabled={u === "serving" && !food.servingSizeG}
              >
                {u === "serving" && food.servingSizeG
                  ? `serving (${food.servingSizeG} g)`
                  : u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meal_type">Meal</Label>
        <select
          id="meal_type"
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
          className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <option value="">(unsorted)</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      {macros ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricBox label="Protein" value={Math.round(macros.protein_g)} unit="g" />
          <MetricBox label="Carbs" value={Math.round(macros.carbs_g)} unit="g" />
          <MetricBox label="Fat" value={Math.round(macros.fat_g)} unit="g" />
          <MetricBox label="Calories" value={Math.round(macros.calories_kcal)} unit="kcal" />
        </div>
      ) : (
        <div
          className="rounded-[var(--r-md)] border border-border p-3"
          style={{ background: "var(--surface-2)" }}
        >
          <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
            Pick a unit with a known conversion to see macros.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Back to search
        </Button>
        <Button onClick={save} disabled={submitting || !macros} className="flex-1">
          {submitting ? "Saving…" : "Log meal"}
        </Button>
      </div>
    </Card>
  );
}

function guessMealType(): string {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}
