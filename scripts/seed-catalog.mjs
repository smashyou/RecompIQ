#!/usr/bin/env node
// Seed the expanded peptide catalog from the safety-reviewed research output.
//
// Reads db/seeds/catalog-data.json (produced by the peptide-catalog-research
// workflow, then audited by the safety-reviewer agent). For each compound:
//   1. upsert the compounds row (by slug)
//   2. replace its compound_dose_reference rows
//   3. replace its compound_synergies rows (resolving paired_compound_id by slug/name)
//
// Every dose figure traces to a citation; research-only peptides carry null
// ranges. Idempotent — safe to re-run. Run: node scripts/seed-catalog.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const env = Object.fromEntries(
  readFileSync(resolve(root, "apps/web/.env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k, rest.join("=").trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function api(path, init = {}) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function main() {
  const dataPath = resolve(root, process.argv[2] ?? "db/seeds/catalog-data.json");
  const entries = JSON.parse(readFileSync(dataPath, "utf8"));
  console.log(`Loaded ${entries.length} compound entries`);

  // 1. Upsert all compounds first so synergy FKs can resolve across the set.
  const compoundRows = entries.map((e) => ({
    slug: e.slug,
    name: e.name,
    aliases: e.aliases ?? [],
    category: e.category,
    evidence_level: e.evidence_level,
    fda_approved: e.fda_approved ?? false,
    short_description: e.short_description,
    mechanism: e.mechanism ?? null,
    typical_route: e.typical_route ?? null,
    monitoring_notes: e.monitoring_notes ?? [],
    absolute_contraindications: e.absolute_contraindications ?? [],
    relative_contraindications: e.relative_contraindications ?? [],
    common_side_effects: e.common_side_effects ?? [],
    serious_adverse_events: e.serious_adverse_events ?? [],
    citations: e.citations ?? [],
  }));

  await api(`/rest/v1/compounds?on_conflict=slug`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(compoundRows),
  });
  console.log(`  ✓ upserted ${compoundRows.length} compounds`);

  // Build a slug/name → id map across the WHOLE catalog (existing + new).
  const allCompounds = await api(`/rest/v1/compounds?select=id,slug,name,aliases`);
  const idBySlug = new Map(allCompounds.map((c) => [c.slug, c.id]));
  const idByName = new Map();
  for (const c of allCompounds) {
    idByName.set(c.name.toLowerCase(), c.id);
    idByName.set(slugify(c.name), c.id);
    for (const a of c.aliases ?? []) idByName.set(a.toLowerCase(), c.id);
  }
  const resolvePartner = (name) =>
    idByName.get(name.toLowerCase()) ?? idBySlug.get(slugify(name)) ?? idByName.get(slugify(name)) ?? null;

  // 2 + 3. Per compound: replace dose refs + synergies.
  let doseCount = 0;
  let synCount = 0;
  for (const e of entries) {
    const compoundId = idBySlug.get(e.slug);
    if (!compoundId) {
      console.warn(`  ! no id for ${e.slug} — skipping refs/synergies`);
      continue;
    }

    // dose references
    await api(`/rest/v1/compound_dose_reference?compound_id=eq.${compoundId}`, { method: "DELETE" });
    const refs = (e.dose_references ?? []).map((r) => ({
      compound_id: compoundId,
      context: r.context,
      route: r.route ?? null,
      low_value: r.low_value ?? null,
      high_value: r.high_value ?? null,
      unit: r.unit,
      frequency: r.frequency ?? null,
      evidence_level: r.evidence_level,
      is_human_data: r.is_human_data ?? false,
      citation: r.citation ?? [],
      notes: r.notes ?? null,
    }));
    if (refs.length) {
      await api(`/rest/v1/compound_dose_reference`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(refs),
      });
      doseCount += refs.length;
    }

    // synergies
    await api(`/rest/v1/compound_synergies?compound_id=eq.${compoundId}`, { method: "DELETE" });
    const syns = (e.synergies ?? []).map((s) => ({
      compound_id: compoundId,
      paired_name: s.with_name,
      paired_compound_id: resolvePartner(s.with_name),
      rationale: s.rationale,
      evidence_level: s.evidence_level,
      is_human_data: s.is_human_data ?? false,
      caution_notes: s.caution_notes ?? null,
      citation: s.citation ?? [],
    }));
    if (syns.length) {
      await api(`/rest/v1/compound_synergies`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(syns),
      });
      synCount += syns.length;
    }
    console.log(`  ✓ ${e.slug}: ${refs.length} dose ref(s), ${syns.length} synergy row(s)`);
  }

  console.log(`\n✓ seeded ${entries.length} compounds, ${doseCount} dose refs, ${synCount} synergies`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
