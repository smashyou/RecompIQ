// Pure shaping for lab readings → per-marker time series. Client-safe; shared by
// the web labs page (SSR + after save/delete) and the mobile labs screen.

import {
  effectiveRange,
  rangeStatus,
  LAB_MARKER_BY_KEY,
  LAB_PANEL_LABEL,
  type RangeStatus,
  type LabPanel,
} from "./catalog";

export interface LabReadingRow {
  id: string;
  panel: string | null;
  marker: string;
  marker_key: string | null;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  collected_on: string;
  source: "manual" | "ocr";
  photo_url: string | null;
  created_at?: string;
}

export interface MarkerSeries {
  key: string; // group key: marker_key or `raw:<marker>`
  marker: string; // display label
  markerKey: string | null;
  panel: string | null;
  panelLabel: string | null;
  unit: string | null;
  readings: LabReadingRow[]; // ascending by collected_on
  latest: LabReadingRow;
  previous: LabReadingRow | null;
  effLow: number | null;
  effHigh: number | null;
  refSource: "report" | "catalog" | "none";
  status: RangeStatus;
  decimals: number;
  /** Catalog range is sex-dependent — UI must caveat when refSource is catalog. */
  sexSpecific: boolean;
}

export function shapeLabSeries(rows: LabReadingRow[]): MarkerSeries[] {
  const groups = new Map<string, LabReadingRow[]>();
  for (const r of rows) {
    const key = r.marker_key ?? `raw:${r.marker.toLowerCase()}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const out: MarkerSeries[] = [];
  for (const [key, arr] of groups) {
    arr.sort((a, b) => a.collected_on.localeCompare(b.collected_on));
    const latest = arr[arr.length - 1];
    if (!latest) continue;
    const previous = arr.length > 1 ? (arr[arr.length - 2] ?? null) : null;
    const def = latest.marker_key ? LAB_MARKER_BY_KEY[latest.marker_key] : undefined;
    const range = effectiveRange(latest.marker_key, latest.ref_low, latest.ref_high);
    out.push({
      key,
      marker: def?.label ?? latest.marker,
      markerKey: latest.marker_key,
      panel: latest.panel ?? def?.panel ?? null,
      panelLabel: panelLabelFor(latest.panel ?? def?.panel ?? null),
      unit: latest.unit ?? def?.unit ?? null,
      readings: arr,
      latest,
      previous,
      effLow: range.low,
      effHigh: range.high,
      refSource: range.source,
      status: rangeStatus(latest.value, range.low, range.high),
      decimals: def?.decimals ?? inferDecimals(latest.value),
      sexSpecific: Boolean(def?.sexSpecific),
    });
  }

  const rank: Record<RangeStatus, number> = { high: 0, low: 0, in: 1, unknown: 2 };
  out.sort((a, b) => {
    const r = rank[a.status] - rank[b.status];
    if (r !== 0) return r;
    return a.marker.localeCompare(b.marker);
  });
  return out;
}

function panelLabelFor(panel: string | null): string | null {
  if (!panel) return null;
  return LAB_PANEL_LABEL[panel as LabPanel] ?? null;
}

function inferDecimals(v: number): number {
  return Number.isInteger(v) ? 0 : 1;
}

export function formatLabValue(v: number, decimals: number): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
