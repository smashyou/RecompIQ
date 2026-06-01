#!/usr/bin/env node
// Fully automated Demo User A seed via Supabase Admin + REST APIs (plain fetch).
// Idempotent — refreshes 14d series each run.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envFile = resolve(__dirname, "..", "apps/web/.env.local");
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      const raw = rest.join("=").trim();
      const unquoted = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      return [k, unquoted];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in apps/web/.env.local");
  process.exit(1);
}

const DEMO_ID = "11111111-1111-1111-1111-111111111111";
const DEMO_EMAIL = "demo@recompiq.app";
const DEMO_PASS = "DemoUser!2026";

const baseHeaders = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: { ...baseHeaders, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// ---------- auth ----------
async function ensureAuthUser() {
  const list = await api(`/auth/v1/admin/users?email=${encodeURIComponent(DEMO_EMAIL)}`);
  const existing = (list.users ?? list).find?.((u) => u.email === DEMO_EMAIL);
  if (existing) {
    console.log(`✓ auth.user exists (${existing.id})`);
    await api(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ password: DEMO_PASS, email_confirm: true }),
    });
    return existing.id;
  }
  const created = await api("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      id: DEMO_ID,
      email: DEMO_EMAIL,
      password: DEMO_PASS,
      email_confirm: true,
      user_metadata: { demo: true },
    }),
  });
  console.log(`✓ auth.user created (${created.id})`);
  return created.id;
}

// ---------- table helpers ----------
async function del(table, query) {
  await api(`/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}
async function insert(table, rows) {
  await api(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
}
async function upsert(table, rows, onConflict) {
  await api(`/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
}

// ---------- profile + settings ----------
async function seedProfile(uid) {
  await upsert(
    "profiles",
    [
      {
        user_id: uid,
        display_name: "Demo User A",
        dob: "1984-06-15",
        sex: "male",
        height_in: 70.5,
        unit_weight: "lb",
        unit_length: "in",
        is_demo: true,
        is_admin: true,
        onboarding_done: true,
      },
    ],
    "user_id",
  );
  await upsert(
    "user_settings",
    [{ user_id: uid, vision_provider: "anthropic" }],
    "user_id",
  );
  console.log("✓ profile + user_settings");
}

// ---------- goal ----------
async function seedGoal(uid) {
  await del("goals", `user_id=eq.${uid}`);
  await insert("goals", [
    {
      user_id: uid,
      start_weight_lb: 265,
      goal_weight_lb_min: 190,
      goal_weight_lb_max: 200,
      timeline_weeks: 26,
      phase: "P1",
      protein_target_g_min: 160,
      protein_target_g_max: 190,
      is_demo: true,
    },
  ]);
  console.log("✓ goal");
}

// ---------- conditions / medications / injuries ----------
async function seedHealthContext(uid) {
  await del("conditions", `user_id=eq.${uid}`);
  await insert("conditions", [
    { user_id: uid, name: "Type 2 diabetes", detail: "Established diagnosis. Glycemic control + fat loss are primary aims.", active: true, is_demo: true },
    { user_id: uid, name: "Stage 1 hypertension", detail: "Per recent in-office readings. Monitoring with home cuff.", active: true, is_demo: true },
    { user_id: uid, name: "Chronic L foot numbness / weakness", detail: "Persistent neuro deficit related to prior lumbar disc herniation.", active: true, is_demo: true },
    { user_id: uid, name: "Lumbar disc herniation (historical)", detail: "Severe sciatica episode resolved. Avoid heavy spinal loading.", active: false, is_demo: true },
    { user_id: uid, name: "Foot drop (historical)", detail: "Largely resolved; residual L-side weakness remains.", active: false, is_demo: true },
  ]);

  await del("medications", `user_id=eq.${uid}`);
  await insert("medications", [
    { user_id: uid, name: "Metformin", dose: "1000 mg twice daily (per prescriber)", active: true, is_demo: true },
    { user_id: uid, name: "Lisinopril", dose: "10 mg daily (per prescriber)", active: true, is_demo: true },
  ]);

  await del("injuries", `user_id=eq.${uid}`);
  await insert("injuries", [
    { user_id: uid, name: "No heavy spinal loading", detail: "Avoid axial compression; favor machines and supported variations.", active: true, is_demo: true },
    { user_id: uid, name: "L foot weakness", detail: "Cannot do single-leg jumps or balance work on left foot.", active: true, is_demo: true },
    { user_id: uid, name: "Deconditioned", detail: "Currently not lifting. P1 is walking + mobility + bands.", active: true, is_demo: true },
  ]);
  console.log("✓ conditions / medications / injuries");
}

// ---------- 14 days of logs ----------
function jitter(amp) {
  return (Math.random() - 0.5) * amp;
}

// Three-meal templates aiming roughly at 170 g protein, 2000 kcal/day for Demo User A.
// Values are per portion (already scaled), so we just insert them.
const MEAL_TEMPLATES = {
  breakfast: [
    { description: "Greek yogurt + berries + oats", amount: 1, unit: "serving", kcal: 410, p: 38, c: 52, f: 8 },
    { description: "Egg whites + 2 whole eggs + avocado", amount: 1, unit: "serving", kcal: 380, p: 36, c: 8, f: 22 },
    { description: "Cottage cheese + pineapple", amount: 1, unit: "serving", kcal: 290, p: 32, c: 24, f: 6 },
  ],
  lunch: [
    { description: "Grilled chicken breast (6 oz) + rice + broccoli", amount: 1, unit: "serving", kcal: 540, p: 58, c: 62, f: 8 },
    { description: "Turkey & avocado wrap", amount: 1, unit: "serving", kcal: 470, p: 42, c: 38, f: 16 },
    { description: "Salmon (5 oz) + quinoa + asparagus", amount: 1, unit: "serving", kcal: 520, p: 46, c: 44, f: 16 },
  ],
  dinner: [
    { description: "Lean ground beef (5 oz) + sweet potato + green beans", amount: 1, unit: "serving", kcal: 580, p: 48, c: 58, f: 18 },
    { description: "Shrimp stir-fry over cauliflower rice", amount: 1, unit: "serving", kcal: 420, p: 44, c: 22, f: 16 },
    { description: "Chicken thigh + brown rice + roasted veg", amount: 1, unit: "serving", kcal: 600, p: 50, c: 60, f: 18 },
  ],
};

async function seedLogs(uid) {
  for (const t of [
    "weights",
    "vitals",
    "symptoms",
    "sleep_logs",
    "water_logs",
    "steps_logs",
    "food_logs",
  ]) {
    await del(t, `user_id=eq.${uid}&is_demo=eq.true`);
  }
  const today = new Date();
  const dayIso = (d) => d.toISOString().slice(0, 10);
  const atTime = (d, hh, mm) => {
    const x = new Date(d);
    x.setHours(hh, mm, 0, 0);
    return x.toISOString();
  };

  const weights = [], vitals = [], symptoms = [], sleep = [], steps = [], foods = [];
  for (let dAgo = 0; dAgo <= 13; dAgo++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dAgo);

    weights.push({
      user_id: uid,
      value_lb: +(265 - (13 - dAgo) * 0.3 + jitter(0.6)).toFixed(2),
      logged_at: atTime(d, 7, 30),
      source: "manual",
      is_demo: true,
    });
    vitals.push({
      user_id: uid,
      logged_at: atTime(d, 7, 35),
      bp_systolic: 138 - Math.floor((13 - dAgo) * 0.2) + Math.floor(Math.random() * 4),
      bp_diastolic: 86 - Math.floor((13 - dAgo) * 0.1) + Math.floor(Math.random() * 3),
      hr: 74 + Math.floor(Math.random() * 8),
      glucose_mgdl: +(155 - (13 - dAgo) * 1.0 + jitter(8)).toFixed(1),
      is_demo: true,
    });
    symptoms.push({
      user_id: uid,
      logged_at: atTime(d, 20, 0),
      mood: 3 + Math.floor(Math.random() * 2),
      energy: 3 + Math.floor(Math.random() * 2),
      pain: 2 + Math.floor(Math.random() * 3),
      appetite: dAgo > 10 ? 2 : 3,
      nausea: dAgo >= 10 && dAgo <= 13,
      reflux: false,
      constipation: false,
      neuro_note: Math.random() < 0.3 ? "L foot tingling on long walks" : null,
      is_demo: true,
    });
    sleep.push({
      user_id: uid,
      night_of: dayIso(d),
      duration_min: Math.round((6.5 + Math.random() * 2) * 60),
      quality: 2 + Math.floor(Math.random() * 3),
      is_demo: true,
    });
    steps.push({
      user_id: uid,
      day: dayIso(d),
      count: 4000 + Math.floor(Math.random() * 3500),
      source: "manual",
      is_demo: true,
    });

    // 3 meals/day, rotating through templates so the dashboard looks lived-in.
    for (const [mealType, time] of [
      ["breakfast", [7, 45]],
      ["lunch", [12, 30]],
      ["dinner", [19, 0]],
    ]) {
      const templates = MEAL_TEMPLATES[mealType];
      const pick = templates[(dAgo + mealType.length) % templates.length];
      foods.push({
        user_id: uid,
        description: pick.description,
        brand: null,
        source: "custom",
        source_id: null,
        amount: pick.amount,
        unit: pick.unit,
        calories_kcal: pick.kcal,
        protein_g: pick.p,
        carbs_g: pick.c,
        fat_g: pick.f,
        meal_type: mealType,
        logged_at: atTime(d, time[0], time[1]),
        is_demo: true,
      });
    }
  }

  await insert("weights", weights);
  await insert("vitals", vitals);
  await insert("symptoms", symptoms);
  await insert("sleep_logs", sleep);
  await insert("steps_logs", steps);
  await insert("food_logs", foods);
  console.log(
    `✓ 14 days × 6 log types (${weights.length + vitals.length + symptoms.length + sleep.length + steps.length + foods.length} rows)`,
  );
}

// ---------------------------------------------------------------------------
// Demo regimen (Phase 1) + 14 days of dose history. The goal-driven Regimen
// model (REGIMEN_GOALS_PRD §4.1) is the live object the app reads.
// Dose values are illustrative *user-supplied* numbers — RecompIQ does not prescribe.
// ---------------------------------------------------------------------------
const DEMO_STACK_ITEMS = [
  { slug: "retatrutide", dose_value: 6, dose_unit: "mg", route: "sc", frequency: "weekly" },
  { slug: "aod-9604",    dose_value: 300, dose_unit: "mcg", route: "sc", frequency: "daily" },
  { slug: "ghk-cu",      dose_value: 2, dose_unit: "mg", route: "sc", frequency: "daily" },
  { slug: "bpc-157",     dose_value: 250, dose_unit: "mcg", route: "sc", frequency: "daily" },
  { slug: "tb-500",      dose_value: 2, dose_unit: "mg", route: "sc", frequency: "weekly" },
  { slug: "kpv",         dose_value: 500, dose_unit: "mcg", route: "oral", frequency: "daily" },
];

async function seedRegimen(uid) {
  // 1. Look up compound IDs by slug
  const compoundsRes = await api(`/rest/v1/compounds?select=id,slug`);
  const slugToId = new Map(compoundsRes.map((c) => [c.slug, c.id]));
  for (const it of DEMO_STACK_ITEMS) {
    if (!slugToId.has(it.slug)) {
      console.warn(`  skip: compound ${it.slug} not in catalog`);
    }
  }

  const startedOn = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

  // 2. Clear prior demo data. Regimen delete cascades phases/items/changes.
  //    Also clear any legacy demo stacks left from the pre-redesign seed.
  await del("regimens", `user_id=eq.${uid}&is_demo=eq.true`);
  await del("peptide_stacks", `user_id=eq.${uid}&is_demo=eq.true`);
  await del("peptide_doses", `user_id=eq.${uid}&is_demo=eq.true`);

  // 3. Create the living regimen + its current Phase 1.
  const regimenRow = await api("/rest/v1/regimens", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: uid,
      title: "My Regimen",
      is_active: true,
      is_demo: true,
    }),
  });
  const regimenId = Array.isArray(regimenRow) ? regimenRow[0].id : regimenRow.id;

  const phaseRow = await api("/rest/v1/regimen_phases", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      regimen_id: regimenId,
      user_id: uid,
      ordinal: 1,
      name: "Phase 1 — fat loss + tissue repair",
      legacy_phase: "P1",
      starts_on: startedOn,
      notes: "Demo data. User-supplied dose values, not prescriptions.",
      is_demo: true,
    }),
  });
  const phaseId = Array.isArray(phaseRow) ? phaseRow[0].id : phaseRow.id;

  // 4. Add regimen items.
  const items = DEMO_STACK_ITEMS.filter((it) => slugToId.has(it.slug)).map((it) => ({
    regimen_id: regimenId,
    phase_id: phaseId,
    user_id: uid,
    compound_id: slugToId.get(it.slug),
    dose_value: it.dose_value,
    dose_unit: it.dose_unit,
    route: it.route,
    frequency: it.frequency,
    source: "user",
    starts_on: startedOn,
    is_demo: true,
  }));
  const itemRows = await api("/rest/v1/regimen_items", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(items),
  });

  // 5. Seed the append-only change-log spine (one 'add' per item).
  await insert(
    "regimen_changes",
    itemRows.map((r) => ({
      regimen_id: regimenId,
      item_id: r.id,
      user_id: uid,
      kind: "add",
      after: {
        compound_id: r.compound_id,
        dose_value: r.dose_value,
        dose_unit: r.dose_unit,
        route: r.route,
        frequency: r.frequency,
      },
      effective_on: startedOn,
    })),
  );

  // 6. 14 days of dose history with ~90% adherence, linked to regimen items.
  const doses = [];
  const today = new Date();
  for (let dAgo = 0; dAgo <= 13; dAgo++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dAgo);
    for (const it of itemRows) {
      // Weekly compounds only fire on Mondays-ish (every 7 days from start).
      const itemDef = DEMO_STACK_ITEMS.find((x) => slugToId.get(x.slug) === it.compound_id);
      if (itemDef?.frequency === "weekly" && dAgo % 7 !== 0) continue;
      const skipped = Math.random() < 0.1;
      doses.push({
        user_id: uid,
        regimen_item_id: it.id,
        compound_id: it.compound_id,
        taken_at: new Date(d.setHours(8, 0, 0, 0)).toISOString(),
        dose_value: it.dose_value,
        dose_unit: it.dose_unit,
        route: it.route,
        injection_site: it.route === "sc" ? ["abd L", "abd R", "thigh L", "thigh R"][dAgo % 4] : null,
        adherence: skipped ? "skipped" : "taken",
        is_demo: true,
      });
    }
  }
  await insert("peptide_doses", doses);
  console.log(`✓ regimen + ${doses.length} doses`);
}

// ---------------------------------------------------------------------------
// Demo vial purchases (inventory & expenses). Illustrative user-entered prices.
// ---------------------------------------------------------------------------
const DEMO_PURCHASES = [
  { slug: "retatrutide", vial_mg: 24, vial_count: 1, price_usd: 210, vendor: "Demo Vendor A", daysAgo: 50 },
  { slug: "aod-9604", vial_mg: 5, vial_count: 2, price_usd: 90, vendor: "Demo Vendor A", daysAgo: 44 },
  { slug: "bpc-157", vial_mg: 10, vial_count: 1, price_usd: 42, vendor: "Demo Vendor B", daysAgo: 30 },
  { slug: "ghk-cu", vial_mg: 50, vial_count: 1, price_usd: 38, vendor: "Demo Vendor B", daysAgo: 30 },
  { slug: "tb-500", vial_mg: 10, vial_count: 1, price_usd: 55, vendor: "Demo Vendor B", daysAgo: 12 },
];

// Demo goals (fat loss primary, then tissue repair + skin — matches the stack).
const DEMO_GOALS = [
  { goal_key: "fat_loss", priority: 1, target: { goal_weight_lb: 195 } },
  { goal_key: "injury_recovery", priority: 2, target: {} },
  { goal_key: "skin_quality", priority: 3, target: {} },
];

async function seedGoals(uid) {
  await del("user_goals", `user_id=eq.${uid}&is_demo=eq.true`);
  await insert(
    "user_goals",
    DEMO_GOALS.map((g) => ({ user_id: uid, ...g, status: "active", is_demo: true })),
  );
  console.log(`✓ ${DEMO_GOALS.length} goals`);
}

// Demo goal-metric history (~21 days) trending toward the demo goals.
async function seedGoalMetrics(uid) {
  await del("goal_metrics", `user_id=eq.${uid}&is_demo=eq.true`);
  const rows = [];
  for (let dAgo = 21; dAgo >= 0; dAgo -= 3) {
    const t = (frac) => frac; // readability
    const at = new Date(Date.now() - dAgo * 86_400_000);
    at.setHours(8, 0, 0, 0);
    const p = (21 - dAgo) / 21; // 0 → 1 progress
    const push = (metric_key, value, unit) =>
      rows.push({ user_id: uid, metric_key, value, unit, logged_at: at.toISOString(), is_demo: true });
    push("waist_cm", Math.round((112 - 6 * p) * 10) / 10, "cm"); // 112 → 106 cm
    push("skin_quality", Math.min(10, Math.round(5 + 3 * p)), "rating"); // 5 → 8
    push("pain_level", Math.max(0, Math.round(6 - 3 * p)), "rating"); // 6 → 3
    push("mobility", Math.min(10, Math.round(4 + 3 * p)), "rating"); // 4 → 7
    void t;
  }
  await insert("goal_metrics", rows);
  console.log(`✓ ${rows.length} goal metrics`);
}

async function seedPurchases(uid) {
  const compoundsRes = await api(`/rest/v1/compounds?select=id,slug`);
  const slugToId = new Map(compoundsRes.map((c) => [c.slug, c.id]));
  await del("peptide_purchases", `user_id=eq.${uid}&is_demo=eq.true`);
  const rows = DEMO_PURCHASES.filter((p) => slugToId.has(p.slug)).map((p) => ({
    user_id: uid,
    compound_id: slugToId.get(p.slug),
    vial_mg: p.vial_mg,
    vial_count: p.vial_count,
    price_usd: p.price_usd,
    vendor: p.vendor,
    purchased_on: new Date(Date.now() - p.daysAgo * 86_400_000).toISOString().slice(0, 10),
    is_demo: true,
  }));
  await insert("peptide_purchases", rows);
  console.log(`✓ ${rows.length} purchases`);
}

// ---------------------------------------------------------------------------
// Demo labs — two blood draws (baseline ~120d ago + recent ~14d ago) showing
// realistic improvement on GLP-1 + fat loss for a T2D/HTN profile. Ref ranges
// mirror the shared LAB_MARKER catalog so highlighting works. Educational demo
// data — tagged is_demo, never a real protocol or diagnosis.
// ---------------------------------------------------------------------------
const DEMO_LABS = [
  // marker_key, marker (label), panel, unit, ref_low, ref_high, [baseline, recent]
  ["hba1c", "Hemoglobin A1c", "metabolic", "%", 4.0, 5.6, [8.1, 7.2]],
  ["glucose_fasting", "Glucose (fasting)", "metabolic", "mg/dL", 70, 99, [152, 124]],
  ["total_cholesterol", "Total cholesterol", "lipids", "mg/dL", 100, 199, [214, 188]],
  ["ldl", "LDL cholesterol", "lipids", "mg/dL", 0, 99, [138, 109]],
  ["hdl", "HDL cholesterol", "lipids", "mg/dL", 40, 100, [38, 43]],
  ["triglycerides", "Triglycerides", "lipids", "mg/dL", 0, 149, [230, 165]],
  ["alt", "ALT", "cmp", "U/L", 9, 46, [52, 38]],
  ["creatinine", "Creatinine", "cmp", "mg/dL", 0.6, 1.3, [1.0, 0.95]],
  ["egfr", "eGFR", "cmp", "mL/min/1.73", 60, 120, [84, 90]],
  ["tsh", "TSH", "thyroid", "mIU/L", 0.45, 4.5, [2.1, 1.9]],
  ["vitamin_d", "Vitamin D (25-OH)", "vitamins", "ng/mL", 30, 100, [24, 31]],
  ["hs_crp", "hs-CRP", "inflammation", "mg/L", 0, 3.0, [4.2, 2.1]],
];
const LAB_DRAW_DAYS = [120, 14]; // baseline, recent

async function seedLabs(uid) {
  await del("lab_results", `user_id=eq.${uid}&is_demo=eq.true`);
  const rows = [];
  LAB_DRAW_DAYS.forEach((daysAgo, drawIdx) => {
    const collectedOn = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    for (const [key, marker, panel, unit, low, high, vals] of DEMO_LABS) {
      rows.push({
        user_id: uid,
        panel,
        marker,
        marker_key: key,
        value: vals[drawIdx],
        unit,
        ref_low: low,
        ref_high: high,
        collected_on: collectedOn,
        source: "manual",
        is_demo: true,
      });
    }
  });
  await insert("lab_results", rows);
  console.log(`✓ ${rows.length} lab results (${LAB_DRAW_DAYS.length} draws)`);
}

// ---------------------------------------------------------------------------
// Demo workouts — 6 Phase-1 sessions across 14 days
// ---------------------------------------------------------------------------
async function seedWorkouts(uid) {
  await del("workouts", `user_id=eq.${uid}&is_demo=eq.true`);

  // Pull template exercises so the seeded sessions look complete.
  const templates = await api(
    `/rest/v1/workout_templates?phase=eq.P1&select=slug,name,session_type,exercises`,
  );
  const tBySlug = new Map(templates.map((t) => [t.slug, t]));

  // Pattern: walk+mobility on Mon/Wed/Fri/Sun; bands on Tue/Sat; mobility-only on Thu.
  const SCHEDULE = [
    { dAgo: 13, slug: "p1-walk-mobility", duration: 32, rpe: 4 },
    { dAgo: 11, slug: "p1-banded-fullbody", duration: 38, rpe: 6 },
    { dAgo: 9, slug: "p1-walk-mobility", duration: 30, rpe: 4 },
    { dAgo: 7, slug: "p1-mobility-only", duration: 15, rpe: 3 },
    { dAgo: 4, slug: "p1-banded-fullbody", duration: 36, rpe: 6 },
    { dAgo: 2, slug: "p1-walk-mobility", duration: 35, rpe: 4 },
  ];

  for (const s of SCHEDULE) {
    const template = tBySlug.get(s.slug);
    if (!template) continue;
    const date = new Date();
    date.setDate(date.getDate() - s.dAgo);
    const dateIso = date.toISOString().slice(0, 10);

    const workoutRow = await api("/rest/v1/workouts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: uid,
        session_type: template.session_type,
        phase: "P1",
        date: dateIso,
        duration_min: s.duration,
        perceived_exertion: s.rpe,
        template_slug: template.slug,
        name: template.name,
        is_demo: true,
      }),
    });
    const workoutId = Array.isArray(workoutRow) ? workoutRow[0].id : workoutRow.id;

    const exerciseRows = (template.exercises ?? []).map((ex, idx) => ({
      workout_id: workoutId,
      user_id: uid,
      order_index: idx,
      name: ex.name,
      sets: ex.sets ?? null,
      reps: ex.reps ?? null,
      load_lb: null,
      duration_min: ex.duration_min ?? null,
      notes: ex.notes ?? null,
      is_demo: true,
    }));
    if (exerciseRows.length > 0) {
      await insert("workout_exercises", exerciseRows);
    }
  }
  console.log(`✓ ${SCHEDULE.length} Phase-1 workout sessions`);
}

// ---------- run ----------
try {
  const uid = await ensureAuthUser();
  await seedProfile(uid);
  await seedGoal(uid);
  await seedHealthContext(uid);
  await seedLogs(uid);
  await seedRegimen(uid);
  await seedPurchases(uid);
  await seedGoals(uid);
  await seedGoalMetrics(uid);
  await seedLabs(uid);
  await seedWorkouts(uid);
  console.log("");
  console.log("=== Demo User A ready ===");
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASS}`);
  console.log("");
  console.log("Sign in at /signin and you'll land directly on /dashboard.");
} catch (err) {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
}
