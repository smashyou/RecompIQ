// Pure, normalized lane model for the unified timeline (PRD §5.6/§8.7).
// All geometry is resolution-independent: x is a fraction 0..1 across the plot,
// vFrac is a fraction 0..1 within the lane (0 = lane min, 1 = lane max). Each
// platform multiplies by its own pixel/viewBox dimensions. No React, no DB.

export type LaneKind = "line" | "bars" | "events" | "markers" | "intervals";
export type LaneTone = "neutral" | "good" | "warn" | "bad" | "accent";

export interface LinePoint {
  frac: number; // x position 0..1
  vFrac: number; // y position 0..1 within lane (already normalized)
  v: number; // raw value
  dateISO: string;
}

export interface BarPoint {
  frac: number;
  vFrac: number;
  v: number;
  dateISO: string;
}

export interface EventDot {
  frac: number;
  dateISO: string;
  label: string;
  tone: LaneTone;
}

export interface IntervalSeg {
  x0: number; // 0..1, clipped to range
  x1: number; // 0..1, clipped to range
  row: number; // gantt row index
  label: string;
  tone: LaneTone;
}

export interface TimelineLane {
  key: string; // 'weight', 'doses', 'goal:skin_quality', …
  label: string;
  kind: LaneKind;
  summary: string; // "268→254 lb", "5× · 142 min", "$435"
  unit: string | null;
  min: number | null; // lane value domain (for axis label)
  max: number | null;
  line?: LinePoint[];
  bars?: BarPoint[];
  events?: EventDot[];
  intervals?: IntervalSeg[];
  rowCount?: number; // number of gantt rows (intervals only)
  /** Scrub readout for a given day; null = no data that day. */
  readAt(dateISO: string): string | null;
}

export interface TimelineModel {
  startISO: string;
  endISO: string;
  ticks: { frac: number; label: string }[];
  lanes: TimelineLane[];
}
