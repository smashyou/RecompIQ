import { useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/States";
import { apiFetch, apiUpload } from "@/lib/api";
import { colors } from "@/lib/theme";

const FOOD_UNIT = ["g", "oz", "ml", "cup", "tbsp", "tsp", "serving", "piece"] as const;
type FoodUnit = (typeof FOOD_UNIT)[number];
const MEAL_TYPE = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPE)[number];

const MEAL_OPTIONS = MEAL_TYPE.map((m) => ({ value: m, label: m }));
const UNIT_OPTIONS = FOOD_UNIT.map((u) => ({ value: u, label: u }));

// Mirrors @peptide/nutrition NutritionFacts (camelCase from /api/food/photo/parse).
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

interface ParsedFoodItem {
  name: string;
  brand?: string | null;
  estimated_grams: number;
  serving_count?: number | null;
  confidence: number;
  meal_type_hint?: MealType | null;
}

interface ParsedItemWithSuggestions extends ParsedFoodItem {
  suggestions: NutritionFacts[];
}

interface ItemDraft {
  parsed: ParsedFoodItem;
  suggestions: NutritionFacts[];
  selectedSourceId: string | null; // suggestion sourceId; null = skip
  amountG: number;
  unit: FoodUnit;
  mealType: MealType;
  note: string;
}

type FlowState =
  | { kind: "idle" }
  | { kind: "uploading"; previewUri: string }
  | { kind: "uploaded"; assetId: string; blobUrl: string }
  | { kind: "parsing"; assetId: string; blobUrl: string }
  | { kind: "review"; assetId: string; blobUrl: string; modelUsed: string }
  | { kind: "saving"; assetId: string };

const G_PER_OZ = 28.3495;
const G_PER_ML = 1.0;

function gramsFor(food: NutritionFacts, amount: number, unit: FoodUnit): number | null {
  switch (unit) {
    case "g":
      return amount;
    case "oz":
      return amount * G_PER_OZ;
    case "ml":
      return amount * G_PER_ML;
    case "serving":
    case "piece":
    case "cup":
    case "tbsp":
    case "tsp":
      if (food.servingSizeG && food.servingSizeG > 0) return amount * food.servingSizeG;
      return null;
    default:
      return null;
  }
}

// Portion math identical to packages/nutrition macrosForPortion.
function macrosForPortion(food: NutritionFacts, amount: number, unit: FoodUnit) {
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

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 21) return "dinner";
  return "snack";
}

function makeDraft(item: ParsedItemWithSuggestions, fallbackMeal: MealType): ItemDraft {
  const first = item.suggestions[0];
  return {
    parsed: item,
    suggestions: item.suggestions,
    selectedSourceId: first?.sourceId ?? null,
    amountG: Math.round(item.estimated_grams),
    unit: "g",
    mealType: item.meal_type_hint ?? fallbackMeal,
    note: "",
  };
}

export default function FoodPhoto() {
  const router = useRouter();
  const [state, setState] = useState<FlowState>({ kind: "idle" });
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [bulkMeal, setBulkMeal] = useState<MealType>(defaultMealType());

  async function pick(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        fromCamera
          ? "Camera access is required to snap a meal."
          : "Photo library access is required to choose a meal photo.",
      );
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (result.canceled || !result.assets[0]) return;
    await upload(result.assets[0].uri);
  }

  async function upload(uri: string) {
    setState({ kind: "uploading", previewUri: uri });
    try {
      const form = new FormData();
      form.append("file", { uri, name: "meal.jpg", type: "image/jpeg" } as never);
      const data = await apiUpload<{ asset_id: string; blob_url: string }>(
        "/api/food/photo/upload",
        form,
      );
      setState({ kind: "uploaded", assetId: data.asset_id, blobUrl: data.blob_url });
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
      setState({ kind: "idle" });
    }
  }

  async function parseNow() {
    if (state.kind !== "uploaded" && state.kind !== "review") return;
    const { assetId, blobUrl } = state;
    setState({ kind: "parsing", assetId, blobUrl });
    try {
      const data = await apiFetch<{ items: ParsedItemWithSuggestions[]; model_used: string }>(
        "/api/food/photo/parse",
        { method: "POST", body: JSON.stringify({ asset_id: assetId }) },
      );
      setDrafts(data.items.map((it) => makeDraft(it, bulkMeal)));
      setState({ kind: "review", assetId, blobUrl, modelUsed: data.model_used });
    } catch (e) {
      Alert.alert("Parse failed", e instanceof Error ? e.message : "Unknown error");
      setState({ kind: "uploaded", assetId, blobUrl });
    }
  }

  function updateDraft(i: number, patch: Partial<ItemDraft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function applyBulkMeal(mt: MealType) {
    setBulkMeal(mt);
    setDrafts((prev) => prev.map((d) => ({ ...d, mealType: mt })));
  }

  function macrosFor(d: ItemDraft) {
    if (!d.selectedSourceId) return null;
    const food = d.suggestions.find((s) => s.sourceId === d.selectedSourceId);
    if (!food) return null;
    return macrosForPortion(food, d.amountG, d.unit);
  }

  async function save() {
    if (state.kind !== "review") return;
    const reviewState = state;
    const items = drafts
      .filter((d) => d.selectedSourceId !== null)
      .map((d) => {
        const food = d.suggestions.find((s) => s.sourceId === d.selectedSourceId);
        if (!food) return null;
        const m = macrosForPortion(food, d.amountG, d.unit);
        if (!m) return null;
        return {
          description: food.description,
          brand: food.brand,
          source: food.source,
          source_id: food.sourceId,
          amount: d.amountG,
          unit: d.unit,
          calories_kcal: m.calories_kcal,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          fiber_g: m.fiber_g,
          sugar_g: m.sugar_g,
          sodium_mg: m.sodium_mg,
          meal_type: d.mealType,
          note: d.note?.trim() || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) {
      Alert.alert("Nothing to log", "Pick a match for at least one item, or cancel.");
      return;
    }

    setState({ kind: "saving", assetId: reviewState.assetId });
    try {
      const data = await apiFetch<{ logged_count: number }>("/api/food/photo/confirm", {
        method: "POST",
        body: JSON.stringify({ asset_id: reviewState.assetId, items }),
      });
      Alert.alert(
        "Logged",
        `Logged ${data.logged_count} item${data.logged_count === 1 ? "" : "s"}.`,
      );
      router.back();
    } catch (e) {
      Alert.alert("Save failed", e instanceof Error ? e.message : "Unknown error");
      setState(reviewState);
    }
  }

  // ---------- render ----------

  if (state.kind === "idle") {
    return (
      <Content className="gap-4">
        <Pressable
          onPress={() => pick(true)}
          className="items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card p-10 active:bg-muted"
        >
          <Ionicons name="camera" size={40} color={colors.mutedForeground} />
          <Text className="text-sm font-medium text-foreground">Snap a photo of your plate</Text>
          <Text className="text-center text-xs text-muted-foreground">
            AI identifies items, you review macros, save in seconds.
          </Text>
        </Pressable>
        <Button title="Take photo" onPress={() => pick(true)} />
        <Button title="Choose from library" variant="outline" onPress={() => pick(false)} />
      </Content>
    );
  }

  if (state.kind === "uploading") {
    return (
      <Content className="gap-4">
        <Preview uri={state.previewUri} />
        <Text className="text-sm text-muted-foreground">Uploading…</Text>
      </Content>
    );
  }

  if (state.kind === "uploaded") {
    return (
      <Content className="gap-4">
        <Preview uri={state.blobUrl} />
        <View className="flex-row gap-3">
          <Button
            title="Replace"
            variant="outline"
            onPress={() => setState({ kind: "idle" })}
            className="flex-1"
          />
          <Button title="Identify food" onPress={parseNow} className="flex-1" />
        </View>
      </Content>
    );
  }

  if (state.kind === "parsing") {
    return (
      <Content className="gap-4">
        <Preview uri={state.blobUrl} />
        <Text className="text-sm text-muted-foreground">Identifying items… (10–30 s)</Text>
      </Content>
    );
  }

  if (state.kind === "saving") {
    return (
      <Content className="gap-4">
        <Text className="text-sm text-muted-foreground">Saving…</Text>
      </Content>
    );
  }

  // review
  const includeCount = drafts.filter((d) => d.selectedSourceId !== null).length;
  return (
    <Content className="gap-4">
      <Preview uri={state.blobUrl} compact />

      <Card className="gap-3">
        <Text className="text-xs text-muted-foreground">
          Identified by <Text className="font-medium text-foreground">{state.modelUsed}</Text>
        </Text>
        <Field label="Meal type for all">
          <Segmented
            options={MEAL_OPTIONS}
            value={bulkMeal}
            onChange={(mt) => applyBulkMeal(mt as MealType)}
          />
        </Field>
      </Card>

      {drafts.length === 0 ? (
        <EmptyState
          title="No food detected"
          hint="Try a sharper photo, or log it manually from Add meal."
        />
      ) : (
        drafts.map((d, i) => (
          <ItemCard
            key={i}
            draft={d}
            macros={macrosFor(d)}
            onPatch={(patch) => updateDraft(i, patch)}
          />
        ))
      )}

      <View className="flex-row gap-3">
        <Button title="Cancel" variant="outline" onPress={() => router.back()} className="flex-1" />
        <Button title={`Save ${includeCount} items`} onPress={save} className="flex-1" />
      </View>
    </Content>
  );
}

function Preview({ uri, compact = false }: { uri: string; compact?: boolean }) {
  return (
    <Image
      source={{ uri }}
      resizeMode={compact ? "cover" : "contain"}
      className={`w-full overflow-hidden rounded-lg border border-border ${
        compact ? "h-40" : "h-72"
      }`}
    />
  );
}

function ItemCard({
  draft,
  macros,
  onPatch,
}: {
  draft: ItemDraft;
  macros: ReturnType<typeof macrosForPortion>;
  onPatch: (patch: Partial<ItemDraft>) => void;
}) {
  const skipped = draft.selectedSourceId === null;
  const conf = draft.parsed.confidence;
  const confClass =
    conf >= 0.7 ? "text-accent" : conf >= 0.4 ? "text-foreground" : "text-muted-foreground";

  return (
    <Card className={`gap-3 ${skipped ? "opacity-60" : ""}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold capitalize text-foreground" numberOfLines={1}>
            {draft.parsed.name}
          </Text>
          <Text className={`text-xs ${confClass}`}>
            confidence {Math.round(conf * 100)}% · est. {Math.round(draft.parsed.estimated_grams)} g
          </Text>
        </View>
        <Pressable
          onPress={() =>
            onPatch({
              selectedSourceId: skipped ? (draft.suggestions[0]?.sourceId ?? null) : null,
            })
          }
          hitSlop={8}
          className="rounded-md border border-border p-1.5 active:bg-muted"
        >
          <Ionicons
            name={skipped ? "add" : "close"}
            size={14}
            color={colors.mutedForeground}
          />
        </Pressable>
      </View>

      {!skipped && draft.suggestions.length > 0 ? (
        <Field label="Match">
          <View className="gap-1.5">
            {draft.suggestions.map((s) => {
              const active = s.sourceId === draft.selectedSourceId;
              return (
                <Pressable
                  key={s.sourceId}
                  onPress={() => onPatch({ selectedSourceId: s.sourceId })}
                  className={`rounded-lg border p-2.5 ${
                    active ? "border-primary bg-muted" : "border-border bg-card"
                  }`}
                >
                  <Text className="text-xs text-foreground" numberOfLines={1}>
                    {s.description}
                    {s.brand ? ` — ${s.brand}` : ""}
                  </Text>
                  <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.source}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}

      {!skipped && draft.suggestions.length === 0 ? (
        <Text className="text-xs text-muted-foreground">
          No match found. Skip this item, or log it manually from Add meal.
        </Text>
      ) : null}

      {!skipped && draft.selectedSourceId ? (
        <View className="flex-row gap-3">
          <Field label="Amount (g)" className="w-24">
            <Input
              keyboardType="number-pad"
              value={String(draft.amountG)}
              onChangeText={(t) => onPatch({ amountG: Math.max(1, Number(t) || 0) })}
            />
          </Field>
          <Field label="Unit" className="flex-1">
            <Segmented
              options={UNIT_OPTIONS}
              value={draft.unit}
              onChange={(u) => onPatch({ unit: u as FoodUnit })}
            />
          </Field>
        </View>
      ) : null}

      {!skipped && draft.selectedSourceId ? (
        <Field label="Meal">
          <Segmented
            options={MEAL_OPTIONS}
            value={draft.mealType}
            onChange={(mt) => onPatch({ mealType: mt as MealType })}
          />
        </Field>
      ) : null}

      {!skipped && draft.selectedSourceId ? (
        <Field label="Note">
          <Input
            placeholder="Note (optional)"
            value={draft.note}
            onChangeText={(t) => onPatch({ note: t })}
          />
        </Field>
      ) : null}

      {!skipped && macros ? (
        <View className="flex-row flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2">
          <Text className="text-xs text-muted-foreground">
            {Math.round(macros.calories_kcal)} kcal
          </Text>
          <Text className="text-xs text-muted-foreground">P {Math.round(macros.protein_g)} g</Text>
          <Text className="text-xs text-muted-foreground">C {Math.round(macros.carbs_g)} g</Text>
          <Text className="text-xs text-muted-foreground">F {Math.round(macros.fat_g)} g</Text>
        </View>
      ) : null}
    </Card>
  );
}
