import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { StatBox } from "@/components/ui/StatBox";
import { apiFetch } from "@/lib/api";
import { useResponsive } from "@/lib/responsive";
import { colors } from "@/lib/theme";

// Mirrors @peptide/nutrition NutritionFacts (camelCase as returned by /api/food/search).
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

// Portion math identical to packages/nutrition macrosForPortion / web computeMacros.
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

const MEAL_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
] as const;

function guessMealType(): string {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}

export default function FoodLog() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NutritionFacts[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NutritionFacts | null>(null);

  useEffect(() => {
    if (!query.trim() || selected) {
      if (!query.trim()) {
        setResults([]);
        setSearchError(null);
      }
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const data = await apiFetch<{ query: string; results: NutritionFacts[] }>(
          `/api/food/search?q=${encodeURIComponent(query)}&limit=12`,
        );
        if (!cancelled) setResults(data.results ?? []);
      } catch (e) {
        if (!cancelled) {
          setSearchError(e instanceof Error ? e.message : "Search failed");
          setResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, selected]);

  if (selected) {
    return <PortionForm food={selected} onCancel={() => setSelected(null)} />;
  }

  return (
    <Content className="gap-4">
      <View className="relative justify-center">
        <Ionicons
          name="search"
          size={16}
          color={colors.mutedForeground}
          style={{ position: "absolute", left: 12, zIndex: 1 }}
        />
        <Input
          autoFocus
          placeholder='e.g. "chicken breast"'
          value={query}
          onChangeText={setQuery}
          className="pl-9"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery("")}
            hitSlop={8}
            style={{ position: "absolute", right: 12 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {searching ? <Text className="text-sm text-muted-foreground">Searching…</Text> : null}
      {searchError ? <Text className="text-sm text-destructive">{searchError}</Text> : null}

      {results.length > 0 ? (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {results.map((r, i) => (
            <Pressable
              key={`${r.source}:${r.sourceId}`}
              onPress={() => setSelected(r)}
              className={`flex-row items-center justify-between gap-3 p-4 active:bg-muted ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {r.description}
                </Text>
                <Text className="text-xs uppercase tracking-wider text-muted-foreground">
                  {r.brand ? `${r.brand} · ` : ""}
                  {r.source}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-foreground">{Math.round(r.caloriesKcal)} kcal</Text>
                <Text className="text-xs text-muted-foreground">
                  per {r.basis === "per_100g" ? "100 g" : `${r.servingSizeG ?? "?"} g`}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!searching && query.trim() && results.length === 0 && !searchError ? (
        <Card>
          <Text className="text-center text-sm text-muted-foreground">
            No results. Try a simpler term or check spelling.
          </Text>
        </Card>
      ) : null}
    </Content>
  );
}

function PortionForm({ food, onCancel }: { food: NutritionFacts; onCancel: () => void }) {
  const router = useRouter();
  const { type } = useResponsive();
  const defaultUnit: Unit = food.servingSizeG ? "serving" : "g";
  const defaultAmount = food.servingSizeG ? 1 : 100;
  const [amountStr, setAmountStr] = useState(String(defaultAmount));
  const [unit, setUnit] = useState<Unit>(defaultUnit);
  const [mealType, setMealType] = useState<string>(guessMealType());
  const [submitting, setSubmitting] = useState(false);

  const amount = Number(amountStr) || 0;
  const macros = useMemo(() => computeMacros(food, amount, unit), [food, amount, unit]);

  // "serving" is only valid when the food discloses a serving size in grams.
  const unitOptions = UNITS.filter((u) => u !== "serving" || !!food.servingSizeG).map((u) => ({
    value: u,
    label: u === "serving" && food.servingSizeG ? `serving (${food.servingSizeG} g)` : u,
  }));

  async function save() {
    if (!macros) {
      Alert.alert("Pick a unit", "Pick a unit that has a known conversion for this food.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/food/log", {
        method: "POST",
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
      router.back();
    } catch (e) {
      Alert.alert("Could not save meal", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Content className="gap-4">
      <Card className="gap-4">
        <View>
          <Text className="text-xs uppercase tracking-wider text-muted-foreground">
            {food.source}
            {food.brand ? ` · ${food.brand}` : ""}
          </Text>
          <Text
            className="mt-0.5 font-semibold text-foreground"
            style={{ fontSize: type.lg }}
          >
            {food.description}
          </Text>
        </View>

        <View className="flex-row gap-3">
          <Field label="Amount" className="flex-1">
            <Input
              keyboardType="decimal-pad"
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0"
            />
          </Field>
        </View>

        <Field label="Unit">
          <Segmented options={unitOptions} value={unit} onChange={(u) => setUnit(u as Unit)} />
        </Field>

        <Field label="Meal">
          <Segmented options={MEAL_OPTIONS} value={mealType} onChange={setMealType} />
        </Field>

        <Field label="Preview">
          {macros ? (
            <View className="flex-row flex-wrap gap-3">
              <StatBox label="kcal" value={`${Math.round(macros.calories_kcal)}`} />
              <StatBox label="Protein" value={`${Math.round(macros.protein_g)} g`} />
              <StatBox label="Carbs" value={`${Math.round(macros.carbs_g)} g`} />
              <StatBox label="Fat" value={`${Math.round(macros.fat_g)} g`} />
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground">
              Pick a unit with a known conversion to see macros.
            </Text>
          )}
        </Field>

        <View className="flex-row gap-3">
          <Button title="Back" variant="outline" onPress={onCancel} className="flex-1" />
          <Button
            title="Log meal"
            onPress={save}
            loading={submitting}
            disabled={!macros}
            className="flex-1"
          />
        </View>
      </Card>
    </Content>
  );
}
