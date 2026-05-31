#!/usr/bin/env node
// Populate peptide_kb.embedding vectors via Voyage AI.
// Idempotent: only embeds rows where embedding IS NULL. Safe to re-run.

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
const VOYAGE_KEY = env.VOYAGE_API_KEY;
if (!URL || !KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}
if (!VOYAGE_KEY) {
  console.error("Missing VOYAGE_API_KEY in apps/web/.env.local");
  console.error("Get one at https://dash.voyageai.com/api-keys and re-run.");
  process.exit(1);
}

const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function sb(path, init = {}) {
  const res = await fetch(`${URL}${path}`, { ...init, headers: { ...sbHeaders, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

async function embed(texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3-large",
      input: texts,
      input_type: "document",
    }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.data.map((d) => d.embedding);
}

const rows = await sb(`/rest/v1/peptide_kb?embedding=is.null&select=id,compound_slug,section,title,text`);
console.log(`rows to embed: ${rows.length}`);
if (rows.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

// Batch 16 at a time
const BATCH = 16;
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  // Compose richer input text for better retrieval signal
  const inputs = batch.map((r) => `[${r.compound_slug} · ${r.section}] ${r.title}\n${r.text}`);
  const vectors = await embed(inputs);
  for (let j = 0; j < batch.length; j++) {
    await sb(`/rest/v1/peptide_kb?id=eq.${batch[j].id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ embedding: vectors[j] }),
    });
  }
  done += batch.length;
  console.log(`  ${done}/${rows.length}`);
}

console.log("\n✓ embeddings populated");
