#!/usr/bin/env node
// Set typical_vial_mg on individual injectable compounds so the reconstitution
// calculator can pre-fill a sensible vial size per peptide. Values are common
// research vial sizes (factual). Oral/non-injectable compounds are left null.
// Idempotent. Run: node scripts/seed-vials.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, "apps/web/.env.local"), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k, r.join("=").trim().replace(/^"(.*)"$/, "$1")]; }),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SECRET_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// slug -> typical vial mg (most common research vial size)
const VIALS = {
  "bpc-157": 10, "tb-500": 10, "ghk-cu": 50, "nad-plus": 500, "mots-c": 10, "dsip": 5,
  "tesamorelin": 10, "epitalon": 10, "igf-1-lr3": 1, "mod-grf-1-29": 10, "ipamorelin": 10,
  "thymosin-alpha-1": 10, "retatrutide": 10, "aod-9604": 5, "vip": 10, "semaglutide": 10,
  "tirzepatide": 10, "sermorelin": 10, "selank": 10, "semax": 10, "cjc-1295-dac": 5,
  "cagrilintide": 10, "5-amino-1mq": 50, "slu-pp-332": 5, "ll-37": 5, "ss-31": 10,
  "ace-031": 1, "aicar": 50, "foxo4-dri": 10, "gdf-8": 1, "ghrp-2": 5, "ghrp-6": 5,
  "hexarelin": 5, "igf-des": 0.1, "follistatin": 1, "ara-290": 10, "pentadeca-arginate": 10,
  "humanin": 10, "thymalin": 10, "kisspeptin": 10, "pt-141": 10, "melanotan-2": 10,
  "kpv": 10, "hgh-frag-176-191": 5, "mazdutide": 100, "survodutide": 10, "pinealon": 20,
  "pnc-27": 10, "na-epitalon-amidate": 5, "snap-8": 5, "p21": 10, "hexarelin-acetate": 5,
};

async function main() {
  let n = 0;
  for (const [slug, vial] of Object.entries(VIALS)) {
    const res = await fetch(`${URL}/rest/v1/compounds?slug=eq.${slug}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ typical_vial_mg: vial }),
    });
    if (res.ok) n++;
    else console.warn(`  ! ${slug}: ${res.status}`);
  }
  console.log(`✓ set typical_vial_mg on ${n} compounds`);
}
main().catch((e) => { console.error(e); process.exit(1); });
