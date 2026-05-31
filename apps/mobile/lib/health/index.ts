import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import type { DailyHealth, HealthAdapter, SyncResult } from "./types";
import { iosAdapter } from "./ios";
import { androidAdapter } from "./android";

export type { DailyHealth, SyncResult } from "./types";

export type HealthEnv = "expo-go" | "ios" | "android" | "unsupported";

// Expo Go (executionEnvironment === "storeClient") can't load the native health
// modules — only a dev/standalone build can. Detect that BEFORE touching any
// native module so Expo Go degrades to a friendly "needs a dev build" screen.
export function healthEnvironment(): HealthEnv {
  if (Constants.executionEnvironment === "storeClient") return "expo-go";
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "unsupported";
}

export const HEALTH_SOURCE_LABEL = Platform.OS === "ios" ? "Apple Health" : "Health Connect";

function adapter(): HealthAdapter | null {
  const env = healthEnvironment();
  if (env === "ios") return iosAdapter;
  if (env === "android") return androidAdapter;
  return null;
}

export async function isHealthAvailable(): Promise<boolean> {
  const a = adapter();
  if (!a) return false;
  try {
    return await a.available();
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  const a = adapter();
  if (!a) throw new Error("Health access needs a development build.");
  return a.requestPermissions();
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const inRange = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

// Reads from the platform aggregator and upserts into the SAME Supabase tables
// the web app reads — so synced data appears on web automatically. Idempotent:
// steps/sleep upsert on their unique day key; weights/vitals dedup by an
// imported marker so re-syncing doesn't duplicate.
export async function syncHealth(uid: string, days = 14): Promise<SyncResult> {
  const a = adapter();
  if (!a) throw new Error("Health sync needs a development build.");
  const daily: DailyHealth[] = await a.readDaily(days);
  const res: SyncResult = { days, steps: 0, weights: 0, vitals: 0, sleep: 0 };
  const fromDate = localDate(new Date(Date.now() - days * 86_400_000));

  // Steps — upsert per day.
  const stepRows = daily
    .filter((d) => d.steps != null && inRange(Math.round(d.steps), 0, 100_000))
    .map((d) => ({ user_id: uid, day: d.date, count: Math.round(d.steps as number), source: "imported" }));
  if (stepRows.length) {
    const { error } = await supabase.from("steps_logs").upsert(stepRows, { onConflict: "user_id,day" });
    if (!error) res.steps = stepRows.length;
  }

  // Sleep — upsert per night.
  const sleepRows = daily
    .filter((d) => d.sleepMin != null && inRange(Math.round(d.sleepMin), 1, 1440))
    .map((d) => ({ user_id: uid, night_of: d.date, duration_min: Math.round(d.sleepMin as number) }));
  if (sleepRows.length) {
    const { error } = await supabase.from("sleep_logs").upsert(sleepRows, { onConflict: "user_id,night_of" });
    if (!error) res.sleep = sleepRows.length;
  }

  // Weights (+ body composition) — dedup vs days that already have an imported weigh-in.
  const wDays = daily.filter((d) => d.weightLb != null && inRange(d.weightLb, 50, 800));
  if (wDays.length) {
    const { data: existing } = await supabase
      .from("weights")
      .select("logged_at")
      .eq("user_id", uid)
      .eq("source", "imported")
      .gte("logged_at", fromDate);
    const seen = new Set((existing ?? []).map((r: { logged_at: string }) => localDate(new Date(r.logged_at))));
    const rows = wDays
      .filter((d) => !seen.has(d.date))
      .map((d) => ({
        user_id: uid,
        value_lb: r1(d.weightLb as number),
        body_fat_pct: d.bodyFatPct != null && inRange(d.bodyFatPct, 0, 80) ? r1(d.bodyFatPct) : null,
        lean_mass_lb: d.leanMassLb != null && inRange(d.leanMassLb, 0, 800) ? r1(d.leanMassLb) : null,
        source: "imported",
        logged_at: new Date(`${d.date}T12:00:00`).toISOString(),
      }));
    if (rows.length) {
      const { error } = await supabase.from("weights").insert(rows);
      if (!error) res.weights = rows.length;
    }
  }

  // Resting HR → one vitals row per day, marked so re-sync dedups.
  const note = `${HEALTH_SOURCE_LABEL} import`;
  const hrDays = daily.filter((d) => d.restingHr != null && inRange(Math.round(d.restingHr), 20, 240));
  if (hrDays.length) {
    const { data: existing } = await supabase
      .from("vitals")
      .select("logged_at")
      .eq("user_id", uid)
      .eq("note", note)
      .gte("logged_at", fromDate);
    const seen = new Set((existing ?? []).map((r: { logged_at: string }) => localDate(new Date(r.logged_at))));
    const rows = hrDays
      .filter((d) => !seen.has(d.date))
      .map((d) => ({ user_id: uid, hr: Math.round(d.restingHr as number), note, logged_at: new Date(`${d.date}T12:00:00`).toISOString() }));
    if (rows.length) {
      const { error } = await supabase.from("vitals").insert(rows);
      if (!error) res.vitals = rows.length;
    }
  }

  await AsyncStorage.setItem("health:lastSync", new Date().toISOString());
  return res;
}

export async function getLastSync(): Promise<string | null> {
  return AsyncStorage.getItem("health:lastSync");
}
