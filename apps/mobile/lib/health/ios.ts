import type { DailyHealth, HealthAdapter } from "./types";

// Apple HealthKit adapter (@kingstinct/react-native-healthkit). The require is
// guarded — it only runs in a native/dev build (never Expo Go, where the
// dispatcher in index.ts short-circuits first). Sample shapes/units should be
// re-verified on a real device when the dev build lands; the parsing here is
// deliberately defensive (multiple field-name fallbacks).
function mod(): any {
  try {
    return require("@kingstinct/react-native-healthkit");
  } catch {
    return null;
  }
}

const READ = [
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierBodyMass",
  "HKQuantityTypeIdentifierBodyFatPercentage",
  "HKQuantityTypeIdentifierLeanBodyMass",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierHeartRate",
  "HKCategoryTypeIdentifierSleepAnalysis",
];

function dayOf(sample: any): string {
  const d = new Date(sample.startDate ?? sample.endDate ?? sample.startTime ?? sample.date ?? Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function val(sample: any): number {
  return Number(sample.quantity ?? sample.value ?? 0);
}

async function querySamples(m: any, id: string, from: Date, to: Date, unit?: string): Promise<any[]> {
  try {
    const res = await m.queryQuantitySamples(id, { from, to, ...(unit ? { unit } : {}) });
    return Array.isArray(res) ? res : (res?.samples ?? []);
  } catch {
    return [];
  }
}

export const iosAdapter: HealthAdapter = {
  async available() {
    const m = mod();
    if (!m) return false;
    try {
      return await m.isHealthDataAvailable();
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    const m = mod();
    if (!m) return false;
    // Must request before querying or HealthKit crashes the app.
    await m.requestAuthorization({ toRead: READ });
    return true;
  },

  async readDaily(days) {
    const m = mod();
    if (!m) return [];
    const to = new Date();
    const from = new Date(Date.now() - days * 86_400_000);
    const map = new Map<string, DailyHealth>();
    const get = (d: string) => {
      let x = map.get(d);
      if (!x) {
        x = { date: d };
        map.set(d, x);
      }
      return x;
    };

    for (const s of await querySamples(m, "HKQuantityTypeIdentifierStepCount", from, to, "count")) {
      const d = get(dayOf(s));
      d.steps = (d.steps ?? 0) + val(s);
    }
    for (const s of await querySamples(m, "HKQuantityTypeIdentifierBodyMass", from, to, "lb")) {
      get(dayOf(s)).weightLb = val(s); // latest sample for the day wins
    }
    for (const s of await querySamples(m, "HKQuantityTypeIdentifierBodyFatPercentage", from, to)) {
      const v = val(s);
      get(dayOf(s)).bodyFatPct = v <= 1 ? v * 100 : v; // HealthKit stores a 0–1 fraction
    }
    for (const s of await querySamples(m, "HKQuantityTypeIdentifierLeanBodyMass", from, to, "lb")) {
      get(dayOf(s)).leanMassLb = val(s);
    }
    for (const s of await querySamples(m, "HKQuantityTypeIdentifierRestingHeartRate", from, to, "count/min")) {
      get(dayOf(s)).restingHr = val(s);
    }

    try {
      const sleep = await m.queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", { from, to });
      for (const s of Array.isArray(sleep) ? sleep : (sleep?.samples ?? [])) {
        const start = new Date(s.startDate ?? s.startTime);
        const end = new Date(s.endDate ?? s.endTime);
        const mins = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
        // value 0 = inBed; 1 = asleep(unspecified); 3/4/5 = sleep stages. Count anything not "inBed".
        if (Number(s.value ?? 1) !== 0) {
          const d = get(dayOf(s));
          d.sleepMin = (d.sleepMin ?? 0) + mins;
        }
      }
    } catch {
      /* sleep optional */
    }

    return Array.from(map.values());
  },
};
