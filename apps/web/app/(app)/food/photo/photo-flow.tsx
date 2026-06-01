"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Sparkles, X } from "lucide-react";
import {
  FOOD_UNIT,
  MEAL_TYPE,
  type FoodUnit,
  type MealType,
  type ParsedFoodItem,
} from "@peptide/shared";
import { macrosForPortion, type NutritionFacts } from "@peptide/nutrition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { Card, Chip } from "@/components/kit";

interface ParsedItemWithSuggestions extends ParsedFoodItem {
  suggestions: NutritionFacts[];
}

type FlowState =
  | { kind: "idle" }
  | { kind: "uploading"; previewUrl: string }
  | { kind: "uploaded"; assetId: string; blobUrl: string }
  | { kind: "parsing"; assetId: string; blobUrl: string }
  | {
      kind: "review";
      assetId: string;
      blobUrl: string;
      items: ParsedItemWithSuggestions[];
      modelUsed: string;
    }
  | { kind: "saving"; assetId: string };

interface ItemDraft {
  parsed: ParsedFoodItem;
  suggestions: NutritionFacts[];
  selectedSourceId: string | null; // suggestion sourceId; null = skip
  amountG: number;
  unit: FoodUnit;
  mealType: MealType;
  note: string;
}

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 21) return "dinner";
  return "snack";
}

function makeDraft(item: ParsedItemWithSuggestions, fallbackMealType: MealType): ItemDraft {
  const first = item.suggestions[0];
  return {
    parsed: item,
    suggestions: item.suggestions,
    selectedSourceId: first?.sourceId ?? null,
    amountG: Math.round(item.estimated_grams),
    unit: "g",
    mealType: item.meal_type_hint ?? fallbackMealType,
    note: "",
  };
}

export function PhotoFlow() {
  const router = useRouter();
  const toast = useFireToast();
  const [state, setState] = useState<FlowState>({ kind: "idle" });
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [bulkMealType, setBulkMealType] = useState<MealType>(defaultMealType());

  async function handleFile(file: File) {
    const previewUrl = URL.createObjectURL(file);
    setState({ kind: "uploading", previewUrl });
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/food/photo/upload", { method: "POST", body: form });
    if (res.status === 401) {
      router.replace("/signin?next=/food/photo");
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Upload failed");
      setState({ kind: "idle" });
      return;
    }
    const body = (await res.json()) as { data: { asset_id: string; blob_url: string } };
    URL.revokeObjectURL(previewUrl);
    setState({ kind: "uploaded", assetId: body.data.asset_id, blobUrl: body.data.blob_url });
  }

  async function parseNow() {
    if (state.kind !== "uploaded" && state.kind !== "review") return;
    const assetId = state.assetId;
    const blobUrl = state.blobUrl;
    setState({ kind: "parsing", assetId, blobUrl });

    const res = await fetch("/api/food/photo/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: assetId }),
    });
    if (res.status === 401) {
      router.replace("/signin?next=/food/photo");
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Parse failed");
      setState({ kind: "uploaded", assetId, blobUrl });
      return;
    }
    const body = (await res.json()) as {
      data: { items: ParsedItemWithSuggestions[]; model_used: string };
    };
    const ml = bulkMealType;
    setDrafts(body.data.items.map((it) => makeDraft(it, ml)));
    setState({
      kind: "review",
      assetId,
      blobUrl,
      items: body.data.items,
      modelUsed: body.data.model_used,
    });
  }

  function updateDraft(i: number, patch: Partial<ItemDraft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function applyBulkMealType(mt: MealType) {
    setBulkMealType(mt);
    setDrafts((prev) => prev.map((d) => ({ ...d, mealType: mt })));
  }

  function macrosFor(draft: ItemDraft) {
    if (!draft.selectedSourceId) return null;
    const food = draft.suggestions.find((s) => s.sourceId === draft.selectedSourceId);
    if (!food) return null;
    return macrosForPortion(food, { amount: draft.amountG, unit: draft.unit });
  }

  async function save() {
    if (state.kind !== "review") return;
    const reviewState = state; // capture so we can restore on error
    const toLog = drafts
      .map((d, idx) => ({ draft: d, idx }))
      .filter(({ draft }) => draft.selectedSourceId !== null);

    if (toLog.length === 0) {
      toast.error("Pick a USDA match for at least one item, or cancel.");
      return;
    }

    const items = toLog
      .map(({ draft }) => {
        const food = draft.suggestions.find((s) => s.sourceId === draft.selectedSourceId);
        if (!food) return null;
        const m = macrosForPortion(food, { amount: draft.amountG, unit: draft.unit });
        if (!m) return null;
        return {
          description: food.description,
          brand: food.brand,
          source: food.source,
          source_id: food.sourceId,
          amount: draft.amountG,
          unit: draft.unit,
          calories_kcal: m.calories_kcal,
          protein_g: m.protein_g,
          carbs_g: m.carbs_g,
          fat_g: m.fat_g,
          fiber_g: m.fiber_g,
          sugar_g: m.sugar_g,
          sodium_mg: m.sodium_mg,
          meal_type: draft.mealType,
          note: draft.note || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) {
      toast.error("Couldn't compute macros for any item. Try a different USDA match.");
      return;
    }

    setState({ kind: "saving", assetId: state.assetId });
    const res = await fetch("/api/food/photo/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: state.assetId, items }),
    });
    if (res.status === 401) {
      router.replace("/signin?next=/food/photo");
      return;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Save failed");
      setState(reviewState);
      return;
    }
    const body = (await res.json()) as { data: { logged_count: number } };
    toast.success(`Logged ${body.data.logged_count} item${body.data.logged_count === 1 ? "" : "s"}`);
    router.replace("/food");
    router.refresh();
  }

  // ---------- render ----------

  if (state.kind === "idle") {
    return <FilePicker onFile={handleFile} />;
  }

  if (state.kind === "uploading") {
    return (
      <Card pad={20} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Preview src={state.previewUrl} />
        <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
          Uploading…
        </p>
      </Card>
    );
  }

  if (state.kind === "uploaded") {
    return (
      <div className="space-y-5">
        <Preview src={state.blobUrl} />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setState({ kind: "idle" })}>
            Replace photo
          </Button>
          <Button className="flex-1" onClick={() => parseNow()}>
            <Sparkles className="mr-2 h-4 w-4" />
            Identify food
          </Button>
        </div>
      </div>
    );
  }

  if (state.kind === "parsing") {
    return (
      <Card pad={20} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Preview src={state.blobUrl} />
        <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
          Identifying items… (10–30 s)
        </p>
      </Card>
    );
  }

  if (state.kind === "saving") {
    return (
      <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
        Saving…
      </p>
    );
  }

  // review
  return (
    <div className="space-y-5">
      <Preview src={state.blobUrl} compact />

      <Card pad={16} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex flex-wrap items-center justify-between gap-2 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
          <span>
            Identified by{" "}
            <span className="font-medium text-foreground">{state.modelUsed}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => parseNow()}>
            Re-parse
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Meal type for all:</Label>
          {MEAL_TYPE.map((mt) => (
            <Chip key={mt} active={bulkMealType === mt} onClick={() => applyBulkMealType(mt)}>
              <span className="capitalize">{mt}</span>
            </Chip>
          ))}
        </div>
      </Card>

      {drafts.length === 0 ? (
        <Card pad={20}>
          <p className="text-center font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
            No food detected. Try a sharper photo or re-parse with a different model.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d, i) => (
            <ItemCard
              key={i}
              draft={d}
              macros={macrosFor(d)}
              onPatch={(patch) => updateDraft(i, patch)}
            />
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <a href="/food">Cancel</a>
        </Button>
        <Button onClick={save} className="flex-1">
          Save {drafts.filter((d) => d.selectedSourceId !== null).length} items
        </Button>
      </div>
    </div>
  );
}

function FilePicker({ onFile }: { onFile: (file: File) => void }) {
  return (
    <label className="block cursor-pointer">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div
        className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border border-dashed border-border p-10 text-center transition-colors hover:bg-[var(--surface-2)]"
        style={{ background: "var(--surface-1)" }}
      >
        <Camera className="h-10 w-10 text-[var(--fg-subtle)]" />
        <div className="space-y-1">
          <p className="font-[family-name:var(--font-sans)] text-sm font-medium text-foreground">
            Snap a photo or upload one
          </p>
          <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
            JPEG · PNG · WEBP · HEIC · 10 MB max
          </p>
        </div>
        <Button asChild>
          <span>
            <Upload className="mr-2 h-4 w-4" />
            Choose photo
          </span>
        </Button>
      </div>
    </label>
  );
}

function Preview({ src, compact = false }: { src: string; compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[var(--r-md)] border border-border ${compact ? "max-h-48" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`w-full ${compact ? "max-h-48 object-cover" : "max-h-96 object-contain"}`}
      />
    </div>
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
  const confidenceColor = useMemo(() => {
    const c = draft.parsed.confidence;
    if (c >= 0.7) return "text-[var(--positive)]";
    if (c >= 0.4) return "text-foreground";
    return "text-[var(--fg-subtle)]";
  }, [draft.parsed.confidence]);

  return (
    <li
      className={`space-y-3 rounded-[var(--r-lg)] border border-border p-4 ${
        skipped ? "opacity-60" : ""
      }`}
      style={{ background: "var(--surface-1)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-sans)] text-sm font-semibold capitalize text-foreground">
            {draft.parsed.name}
          </p>
          <p className={`font-[family-name:var(--font-sans)] text-xs ${confidenceColor}`}>
            confidence{" "}
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {Math.round(draft.parsed.confidence * 100)}%
            </span>{" "}
            · est.{" "}
            <span className="font-[family-name:var(--font-mono)] tabular-nums">
              {Math.round(draft.parsed.estimated_grams)} g
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onPatch({
              selectedSourceId: skipped ? draft.suggestions[0]?.sourceId ?? null : null,
            })
          }
          className="rounded-[var(--r-sm)] border border-border p-1 text-[var(--fg-subtle)] hover:bg-[var(--surface-2)]"
          aria-label={skipped ? "Include" : "Skip"}
          title={skipped ? "Include" : "Skip"}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {!skipped && draft.suggestions.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Match</Label>
          <select
            value={draft.selectedSourceId ?? ""}
            onChange={(e) => onPatch({ selectedSourceId: e.target.value })}
            className="w-full rounded-[var(--r-sm)] border border-border bg-transparent px-2 py-1.5 font-[family-name:var(--font-sans)] text-xs"
          >
            {draft.suggestions.map((s) => (
              <option key={s.sourceId} value={s.sourceId}>
                {s.description}
                {s.brand ? ` — ${s.brand}` : ""} ({s.source})
              </option>
            ))}
          </select>
        </div>
      )}

      {!skipped && draft.suggestions.length === 0 && (
        <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
          No USDA match found. Skip this item or log it manually from /food/log.
        </p>
      )}

      {!skipped && draft.selectedSourceId && (
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1 space-y-1">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              step="1"
              value={draft.amountG}
              onChange={(e) => onPatch({ amountG: Math.max(1, Number(e.target.value) || 0) })}
              className="text-xs"
            />
          </div>
          <div className="col-span-1 space-y-1">
            <Label className="text-xs">Unit</Label>
            <select
              value={draft.unit}
              onChange={(e) => onPatch({ unit: e.target.value as FoodUnit })}
              className="w-full rounded-[var(--r-sm)] border border-border bg-transparent px-2 py-1.5 font-[family-name:var(--font-sans)] text-xs"
            >
              {FOOD_UNIT.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1 space-y-1">
            <Label className="text-xs">Meal</Label>
            <select
              value={draft.mealType}
              onChange={(e) => onPatch({ mealType: e.target.value as MealType })}
              className="w-full rounded-[var(--r-sm)] border border-border bg-transparent px-2 py-1.5 font-[family-name:var(--font-sans)] text-xs capitalize"
            >
              {MEAL_TYPE.map((mt) => (
                <option key={mt} value={mt} className="capitalize">{mt}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {!skipped && macros && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--fg-subtle)]">
          <span>{Math.round(macros.calories_kcal)} kcal</span>
          <span>P {Math.round(macros.protein_g)} g</span>
          <span>C {Math.round(macros.carbs_g)} g</span>
          <span>F {Math.round(macros.fat_g)} g</span>
        </div>
      )}
    </li>
  );
}
