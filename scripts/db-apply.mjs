/**
 * Apply a .sql migration via the Supabase Management API — no DB password needed,
 * just the personal access token (SUPABASE_ACCESS_TOKEN). Useful because
 * `supabase db push` needs a direct Postgres connection (DB password) that this
 * project doesn't have handy.
 *
 *   node scripts/db-apply.mjs supabase/migrations/<file>.sql
 *
 * Loads SUPABASE_ACCESS_TOKEN + project ref from apps/web/.env.local if not in
 * the environment. Idempotent only insofar as the SQL itself is (ours use
 * IF NOT EXISTS / defaults).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");

function loadEnvLocal() {
  const p = resolve(repoRoot, "apps/web/.env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function refFromUrl(url) {
  const m = (url ?? "").match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
  return m ? m[1] : null;
}

async function main() {
  loadEnvLocal();
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/db-apply.mjs <path-to.sql>");
    process.exit(1);
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref =
    process.env.SUPABASE_PROJECT_REF ?? refFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!token) {
    console.error("✗ SUPABASE_ACCESS_TOKEN not found (env or apps/web/.env.local).");
    process.exit(1);
  }
  if (!ref) {
    console.error("✗ Could not determine project ref (set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL).");
    process.exit(1);
  }

  const sql = readFileSync(resolve(repoRoot, file), "utf8");
  console.log(`Applying ${file} to project ${ref} via Management API…`);

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`✗ ${res.status} ${res.statusText}\n${text}`);
    process.exit(1);
  }
  console.log(`✓ Applied. Response: ${text || "(empty)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
