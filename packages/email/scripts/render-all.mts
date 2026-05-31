/**
 * Render every template to static HTML + plain-text for review. SENDS NOTHING.
 *
 *   pnpm --filter @peptide/email preview
 *
 * Output lands in packages/email/.preview/ as <name>.html / <name>.txt plus an
 * index.html. Group A (auth) templates render with their Supabase placeholders
 * intact — that HTML is exactly what you paste into the Supabase dashboard.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTemplate } from "../src/render";
import { templates, TEMPLATE_NAMES } from "../src/templates";
import type { TemplatePropsMap } from "../src/templates";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../.preview");

// Sample props per template. Auth templates get {} so the {{ .X }} Supabase
// placeholders render literally (paste-ready output).
const samples: { [K in keyof TemplatePropsMap]: TemplatePropsMap[K] } = {
  "confirm-signup": {},
  "magic-link": {},
  "reset-password": {},
  "email-change": {},
  welcome: { firstName: "Alex" },
  "weekly-summary": {
    firstName: "Alex",
    weekRange: "May 19 – May 25",
    weightChange: "−2.4",
    weightChangeUnit: "lb",
    weightTrend: "down",
    currentWeight: "258.6",
    proteinAvg: "171",
    proteinTarget: "160–190",
    doseAdherencePct: 92,
    daysLogged: 6,
  },
  "body-shot-reminder": { firstName: "Alex", daysSinceLast: 9 },
  "dose-weigh-in-reminder": {
    firstName: "Alex",
    items: [
      { label: "Retatrutide + AOD-9604", detail: "your scheduled protocol" },
      { label: "KLOW blend", detail: "evening" },
    ],
    includeWeighIn: true,
  },
  "account-deletion": {
    firstName: "Alex",
    effectiveDate: "May 31, 2026",
    exportUrl: "https://recompiq.vercel.app/exports/final.zip",
  },
  "data-export-ready": {
    firstName: "Alex",
    downloadUrl: "https://recompiq.vercel.app/exports/preview.zip",
    expiresAt: "June 7, 2026",
    formats: "JSON + CSV",
  },
};

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const rows: string[] = [];
  for (const name of TEMPLATE_NAMES) {
    const { html, text, subject } = await renderTemplate(name, samples[name]);
    await writeFile(resolve(outDir, `${name}.html`), html, "utf8");
    await writeFile(resolve(outDir, `${name}.txt`), text, "utf8");
    const group = templates[name].group;
    rows.push(
      `<tr><td><code>${group}</code></td><td><a href="./${name}.html">${name}</a></td>` +
        `<td>${subject}</td><td><a href="./${name}.txt">text</a></td></tr>`,
    );
    console.log(`✓ ${group.padEnd(9)} ${name}`);
  }

  const index = `<!doctype html><meta charset="utf-8"><title>RecompIQ email previews</title>
<style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;background:#16191f;color:#f4f5f7;padding:32px;max-width:760px;margin:0 auto}
h1{font-weight:600}a{color:#46d4de}code{color:#888e98}table{border-collapse:collapse;width:100%}
td{padding:8px 10px;border-bottom:1px solid #30343c;vertical-align:top}th{text-align:left;padding:8px 10px;color:#888e98;font-size:11px;text-transform:uppercase;letter-spacing:.08em}</style>
<h1>Recomp<span style="color:#1FC2CE">IQ</span> email previews</h1>
<p style="color:#b3b8c1">${TEMPLATE_NAMES.length} templates · rendered, not sent. Auth templates show Supabase <code>{{ .X }}</code> placeholders intact.</p>
<table><tr><th>Group</th><th>Template</th><th>Subject</th><th></th></tr>${rows.join("")}</table>`;
  await writeFile(resolve(outDir, "index.html"), index, "utf8");

  console.log(`\n${TEMPLATE_NAMES.length} templates → ${outDir}`);
  console.log(`Open: ${resolve(outDir, "index.html")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
