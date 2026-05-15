"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";

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
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching && (
        <p className="text-sm text-[var(--color-muted-foreground)]">Searching…</p>
      )}
      {searchError && (
        <p className="text-sm text-[var(--color-destructive)]">{searchError}</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
          {results.map((r) => (
            <li key={`${r.source}:${r.sourceId}`}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[var(--color-muted)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.description}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {r.brand ? `${r.brand} · ` : ""}
                    <span className="uppercase tracking-wider">{r.source}</span>
                  </p>
                </div>
                <div className="text-right text-xs tabular-nums text-[var(--color-muted-foreground)]">
                  <p>{Math.round(r.caloriesKcal)} kcal</p>
                  <p>per {r.basis === "per_100g" ? "100 g" : `${r.servingSizeG ?? "?"} g`}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && query.trim() && results.length === 0 && !searchError && (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
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
    <div className="space-y-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
          {food.source}
          {food.brand ? ` · ${food.brand}` : ""}
        </p>
        <h2 className="text-lg font-semibold">{food.description}</h2>
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

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
        {macros ? (
          <dl className="grid grid-cols-4 gap-2 text-center text-xs">
            <Stat label="kcal" value={macros.calories_kcal} />
            <Stat label="P" value={macros.protein_g} suffix="g" />
            <Stat label="C" value={macros.carbs_g} suffix="g" />
            <Stat label="F" value={macros.fat_g} suffix="g" />
          </dl>
        ) : (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Pick a unit with a known conversion to see macros.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Back to search
        </Button>
        <Button onClick={save} disabled={submitting || !macros} className="flex-1">
          {submitting ? "Saving…" : "Log meal"}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="tabular-nums">
        {Math.round(value)}
        {suffix ?? ""}
      </dd>
    </div>
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
