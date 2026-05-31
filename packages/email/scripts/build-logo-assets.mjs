/**
 * Rasterize the brand SVG mark to hosted PNGs for use in emails (SVG is
 * stripped by Gmail/Outlook/Yahoo). Outputs to apps/web/public/email/ so they
 * serve from NEXT_PUBLIC_APP_URL/email/*.png — the URL the email Header uses.
 *
 *   node scripts/build-logo-assets.mjs        (run via: pnpm --filter @peptide/email assets)
 *
 * Source of truth: Design/design_handoff_recompiq/assets/logo-mark.svg. We keep
 * a copy of its path markup inline so the script doesn't depend on the Design
 * folder being present at build time.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const outDir = resolve(repoRoot, "apps/web/public/email");

// Verbatim from Design/design_handoff_recompiq/assets/logo-mark.svg.
const MARK_SVG = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RecompIQ mark">
  <defs>
    <linearGradient id="riPulse" x1="15" y1="35" x2="51" y2="21" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1FC2CE"></stop>
      <stop offset="1" stop-color="#2FDB92"></stop>
    </linearGradient>
  </defs>
  <path d="M32 10 L51 21 V43 L32 54 L13 43 V21 Z" stroke="#3E939A" stroke-width="2.6" stroke-linejoin="round"></path>
  <path d="M15 35 H24 L27 35 L30 25 L33 43 L36 33 L40 33 L51 21" stroke="url(#riPulse)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"></path>
  <circle cx="51" cy="21" r="3.6" fill="#2FDB92"></circle>
</svg>`;

async function png(size) {
  return sharp(Buffer.from(MARK_SVG), { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  // 1x (44px) + 2x (88px) for the 22px header lockup retina render.
  const [one, two] = await Promise.all([png(44), png(88)]);
  await writeFile(resolve(outDir, "logo-mark.png"), one);
  await writeFile(resolve(outDir, "logo-mark@2x.png"), two);
  console.log(`✓ wrote logo-mark.png (44px) + logo-mark@2x.png (88px) to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
