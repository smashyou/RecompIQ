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

async function seedLogs(uid) {
  for (const t of ["weights", "vitals", "symptoms", "sleep_logs", "water_logs", "steps_logs"]) {
    await del(t, `user_id=eq.${uid}&is_demo=eq.true`);
  }
  const today = new Date();
  const dayIso = (d) => d.toISOString().slice(0, 10);
  const atTime = (d, hh, mm) => {
    const x = new Date(d);
    x.setHours(hh, mm, 0, 0);
    return x.toISOString();
  };

  const weights = [], vitals = [], symptoms = [], sleep = [], steps = [];
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
  }

  await insert("weights", weights);
  await insert("vitals", vitals);
  await insert("symptoms", symptoms);
  await insert("sleep_logs", sleep);
  await insert("steps_logs", steps);
  console.log(`✓ 14 days × 5 log types (${weights.length + vitals.length + symptoms.length + sleep.length + steps.length} rows)`);
}

// ---------- run ----------
try {
  const uid = await ensureAuthUser();
  await seedProfile(uid);
  await seedGoal(uid);
  await seedHealthContext(uid);
  await seedLogs(uid);
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
