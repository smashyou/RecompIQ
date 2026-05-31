/**
 * Push the DNS records Resend gives you (after you add send.recompiq.com in the
 * Resend dashboard) into Cloudflare via the API token in apps/web/.env.local.
 *
 *   1. In Resend → Domains → Add Domain → "send.recompiq.com".
 *   2. Copy the records Resend shows into packages/email/resend-dns.json
 *      (see resend-dns.example.json for the shape).
 *   3. node packages/email/scripts/add-resend-dns.mjs            (dry run)
 *      node packages/email/scripts/add-resend-dns.mjs --apply    (create/update)
 *
 * Idempotent: matches existing records by (type, name) and updates rather than
 * duplicating. Touches ONLY the records you list — it never deletes the
 * Cloudflare Email Routing (inbound) MX/TXT records.
 *
 * Env (auto-loaded from apps/web/.env.local if present):
 *   CLOUDFLARE_CUSTOM_TOKEN   API token with Zone:DNS:Edit on recompiq.com
 *   CLOUDFLARE_ZONE_ID        defaults to the recompiq.com zone below
 */
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const DEFAULT_ZONE_ID = "d7aedcfa3ad4117463014e8bb41f97f3"; // recompiq.com
const RECORDS_FILE = resolve(here, "..", "resend-dns.json");

// --- tiny .env.local loader (no dependency) ---------------------------------
function loadEnvLocal() {
  const envPath = resolve(repoRoot, "apps/web/.env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

const CF = "https://api.cloudflare.com/client/v4";

async function cf(token, path, init = {}) {
  const res = await fetch(`${CF}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(
      `Cloudflare ${init.method ?? "GET"} ${path} failed: ${JSON.stringify(json.errors)}`,
    );
  }
  return json.result;
}

async function main() {
  loadEnvLocal();
  const apply = process.argv.includes("--apply");
  const token = process.env.CLOUDFLARE_CUSTOM_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID || DEFAULT_ZONE_ID;

  if (!token) {
    console.error("✗ CLOUDFLARE_CUSTOM_TOKEN not found (checked env + apps/web/.env.local).");
    process.exit(1);
  }
  if (!existsSync(RECORDS_FILE)) {
    console.error(
      `✗ ${RECORDS_FILE} not found.\n  Copy resend-dns.example.json → resend-dns.json and fill in the values Resend gave you.`,
    );
    process.exit(1);
  }

  const records = JSON.parse(await readFile(RECORDS_FILE, "utf8"));
  if (!Array.isArray(records) || records.length === 0) {
    console.error("✗ resend-dns.json must be a non-empty array of records.");
    process.exit(1);
  }

  console.log(`Zone ${zoneId} · ${records.length} record(s) · ${apply ? "APPLY" : "DRY RUN"}\n`);

  const existing = await cf(token, `/zones/${zoneId}/dns_records?per_page=200`);

  for (const r of records) {
    if (!r.type || !r.name || !r.content) {
      console.error(`  ✗ skipping malformed record: ${JSON.stringify(r)}`);
      continue;
    }
    const body = {
      type: r.type,
      name: r.name,
      content: r.content,
      ttl: r.ttl ?? 3600,
      ...(r.priority != null ? { priority: r.priority } : {}),
      ...(r.type === "TXT" ? {} : { proxied: false }),
    };
    const match = existing.find(
      (e) => e.type === r.type && e.name === r.name.replace(/\.$/, ""),
    );
    const label = `${r.type.padEnd(5)} ${r.name}`;

    if (!apply) {
      console.log(`  ${match ? "~ would update" : "+ would create"}  ${label}`);
      continue;
    }
    if (match) {
      await cf(token, `/zones/${zoneId}/dns_records/${match.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      console.log(`  ~ updated  ${label}`);
    } else {
      await cf(token, `/zones/${zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      console.log(`  + created  ${label}`);
    }
  }

  if (!apply) console.log("\nDry run only. Re-run with --apply to write these records.");
  else console.log("\n✓ Done. Verify in Resend (it polls for propagation).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
