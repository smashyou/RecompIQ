import type { DailyHealth, HealthAdapter } from "./types";

// Android Health Connect adapter (react-native-health-connect). Guarded require
// (only runs in a native/dev build). Record shapes should be re-verified on a
// real device; parsing is defensive. Health Connect is the aggregator that
// scale apps (Arboleaf, Renpho, Withings, …) + Wear OS write into.
function mod(): any {
  try {
    return require("react-native-health-connect");
  } catch {
    return null;
  }
}

const KG_TO_LB = 2.20462;

function dayOf(t: any): string {
  const d = new Date(t ?? Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function read(m: any, type: string, from: Date, to: Date): Promise<any[]> {
  try {
    const r = await m.readRecords(type, {
      timeRangeFilter: { operator: "between", startTime: from.toISOString(), endTime: to.toISOString() },
    });
    return r?.records ?? (Array.isArray(r) ? r : []);
  } catch {
    return [];
  }
}

export const androidAdapter: HealthAdapter = {
  async available() {
    const m = mod();
    if (!m) return false;
    try {
      const status = await m.getSdkStatus();
      return status === (m.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3);
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    const m = mod();
    if (!m) return false;
    await m.initialize();
    await m.requestPermission([
      { accessType: "read", recordType: "Steps" },
      { accessType: "read", recordType: "Weight" },
      { accessType: "read", recordType: "BodyFat" },
      { accessType: "read", recordType: "LeanBodyMass" },
      { accessType: "read", recordType: "HeartRate" },
      { accessType: "read", recordType: "SleepSession" },
    ]);
    return true;
  },

  async readDaily(days) {
    const m = mod();
    if (!m) return [];
    try {
      await m.initialize();
    } catch {
      /* already initialized */
    }
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

    for (const r of await read(m, "Steps", from, to)) {
      const d = get(dayOf(r.startTime ?? r.time));
      d.steps = (d.steps ?? 0) + Number(r.count ?? 0);
    }
    for (const r of await read(m, "Weight", from, to)) {
      const lb = r.weight?.inPounds ?? (r.weight?.inKilograms != null ? r.weight.inKilograms * KG_TO_LB : undefined);
      if (lb != null) get(dayOf(r.time)).weightLb = lb;
    }
    for (const r of await read(m, "BodyFat", from, to)) {
      const p = r.percentage ?? r.bodyFat?.value;
      if (p != null) get(dayOf(r.time)).bodyFatPct = Number(p);
    }
    for (const r of await read(m, "LeanBodyMass", from, to)) {
      const lb = r.mass?.inPounds ?? (r.mass?.inKilograms != null ? r.mass.inKilograms * KG_TO_LB : undefined);
      if (lb != null) get(dayOf(r.time)).leanMassLb = lb;
    }
    for (const r of await read(m, "HeartRate", from, to)) {
      const samples = r.samples ?? [];
      const bpms = samples.map((s: any) => Number(s.beatsPerMinute)).filter((n: number) => n > 0);
      if (bpms.length) get(dayOf(r.startTime ?? samples[0]?.time)).restingHr = Math.min(...bpms); // resting ≈ daily min
    }
    for (const r of await read(m, "SleepSession", from, to)) {
      const mins = Math.max(0, (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 60_000);
      const d = get(dayOf(r.startTime));
      d.sleepMin = (d.sleepMin ?? 0) + mins;
    }

    return Array.from(map.values());
  },
};
