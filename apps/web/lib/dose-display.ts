// Shared helpers for turning a dose-reference row into an educational display
// string. Numbers here are always passed through wrapDoseLike() by the caller
// before rendering so the [edu] badge + clinician disclaimer attach.

export interface DoseRefLike {
  context: string;
  route: string | null;
  low_value: number | null;
  high_value: number | null;
  unit: string;
  frequency: string | null;
  evidence_level: string;
  is_human_data: boolean;
}

export function doseRangeText(row: DoseRefLike): string {
  const u = row.unit;
  let core: string;
  if (row.low_value !== null && row.high_value !== null) {
    core =
      row.low_value === row.high_value
        ? `${row.low_value} ${u}`
        : `${row.low_value}–${row.high_value} ${u}`;
  } else if (row.low_value !== null) {
    core = `from ${row.low_value} ${u}`;
  } else if (row.high_value !== null) {
    core = `up to ${row.high_value} ${u}`;
  } else {
    core = "no established range";
  }
  return row.frequency ? `${core}, ${row.frequency}` : core;
}

// A single representative range for the header stat box: widest human-data
// range if any human data exists, else the widest of whatever is present.
export function representativeRange(rows: DoseRefLike[]): string {
  const withNumbers = rows.filter((r) => r.low_value !== null || r.high_value !== null);
  if (withNumbers.length === 0) return "—";
  const human = withNumbers.filter((r) => r.is_human_data);
  const pool = human.length > 0 ? human : withNumbers;
  // Group by unit; pick the unit with the most rows for a coherent range.
  const byUnit = new Map<string, DoseRefLike[]>();
  for (const r of pool) {
    const list = byUnit.get(r.unit) ?? [];
    list.push(r);
    byUnit.set(r.unit, list);
  }
  let bestUnit = "";
  let bestCount = 0;
  for (const [unit, list] of byUnit) {
    if (list.length > bestCount) {
      bestCount = list.length;
      bestUnit = unit;
    }
  }
  const inUnit = byUnit.get(bestUnit) ?? [];
  const lows = inUnit.map((r) => r.low_value ?? r.high_value!).filter((v) => v !== null);
  const highs = inUnit.map((r) => r.high_value ?? r.low_value!).filter((v) => v !== null);
  const lo = Math.min(...lows);
  const hi = Math.max(...highs);
  return lo === hi ? `${lo} ${bestUnit}` : `${lo}–${hi} ${bestUnit}`;
}

// Most common frequency across rows, for the header stat box.
export function commonFrequency(rows: DoseRefLike[]): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.frequency) continue;
    counts.set(r.frequency, (counts.get(r.frequency) ?? 0) + 1);
  }
  let best = "—";
  let bestN = 0;
  for (const [f, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = f;
    }
  }
  return best;
}

const ROUTE_LABEL: Record<string, string> = {
  sc: "Subcutaneous",
  im: "Intramuscular",
  iv: "Intravenous",
  oral: "Oral",
  nasal: "Intranasal",
  topical: "Topical",
  other: "Other",
};
export const routeLabel = (r: string | null) => (r ? ROUTE_LABEL[r] ?? r : "—");

const CATEGORY_LABEL: Record<string, string> = {
  incretin: "Incretin",
  growth_factor: "Growth factor",
  tissue_repair: "Tissue repair",
  metabolic: "Metabolic",
  longevity: "Longevity",
  other: "Other",
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c;
