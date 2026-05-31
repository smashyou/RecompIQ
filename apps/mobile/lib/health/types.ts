// One day's worth of aggregated health metrics, normalized to app units
// (pounds, percent, bpm, minutes). Sourced from Apple Health / Health Connect,
// which themselves aggregate from the watch + any scale app (Arboleaf, Renpho,
// Withings, …) the user has syncing into them.
export interface DailyHealth {
  date: string; // YYYY-MM-DD (local)
  steps?: number;
  weightLb?: number;
  bodyFatPct?: number;
  leanMassLb?: number;
  restingHr?: number;
  sleepMin?: number;
}

export interface HealthAdapter {
  available(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  readDaily(days: number): Promise<DailyHealth[]>;
}

export interface SyncResult {
  days: number;
  steps: number;
  weights: number;
  vitals: number;
  sleep: number;
}
