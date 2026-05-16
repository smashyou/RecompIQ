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
      return [k, rest.join("=").trim()];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
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
// Demo Phase-1 peptide stack + 14 days of dose history.
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

async function seedPeptideStack(uid) {
  // 1. Look up compound IDs by slug
  const compoundsRes = await api(`/rest/v1/compounds?select=id,slug`);
  const slugToId = new Map(compoundsRes.map((c) => [c.slug, c.id]));
  for (const it of DEMO_STACK_ITEMS) {
    if (!slugToId.has(it.slug)) {
      console.warn(`  skip: compound ${it.slug} not in catalog`);
    }
  }

  // 2. Clear any prior demo stacks (cascade deletes items + doses via FK)
  await del("peptide_stacks", `user_id=eq.${uid}&is_demo=eq.true`);
  // Doses with stack_item_id will null on cascade, but is_demo flag cleans them too.
  await del("peptide_doses", `user_id=eq.${uid}&is_demo=eq.true`);

  // 3. Create the Phase-1 stack
  const stackRow = await api("/rest/v1/peptide_stacks", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: uid,
      name: "Phase 1 — fat loss + tissue repair",
      phase: "P1",
      started_on: new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10),
      notes: "Demo data. User-supplied dose values, not prescriptions.",
      is_active: true,
      is_demo: true,
    }),
  });
  const stackId = Array.isArray(stackRow) ? stackRow[0].id : stackRow.id;

  // 4. Add stack items
  const items = DEMO_STACK_ITEMS.filter((it) => slugToId.has(it.slug)).map((it) => ({
    stack_id: stackId,
    user_id: uid,
    compound_id: slugToId.get(it.slug),
    dose_value: it.dose_value,
    dose_unit: it.dose_unit,
    route: it.route,
    frequency: it.frequency,
    is_demo: true,
  }));
  const itemRows = await api("/rest/v1/peptide_stack_items", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(items),
  });
  const itemByCompound = new Map(itemRows.map((r) => [r.compound_id, r.id]));

  // 5. 14 days of dose history with ~90% adherence
  const doses = [];
  const today = new Date();
  for (let dAgo = 0; dAgo <= 13; dAgo++) {
    const d = new Date(today);
    d.setDate(today.getDate() - dAgo);
    for (const it of items) {
      // Weekly compounds only fire on Mondays-ish (every 7 days from start).
      const itemDef = DEMO_STACK_ITEMS.find((x) => slugToId.get(x.slug) === it.compound_id);
      if (itemDef?.frequency === "weekly" && dAgo % 7 !== 0) continue;
      const skipped = Math.random() < 0.1;
      doses.push({
        user_id: uid,
        stack_item_id: it.id,
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
  console.log(`✓ peptide stack + ${doses.length} doses`);
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
  await seedPeptideStack(uid);
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
