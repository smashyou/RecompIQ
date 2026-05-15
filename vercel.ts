// Vercel project configuration as TypeScript.
// Docs: https://vercel.com/docs/project-configuration/vercel-ts
//
// We DO NOT use vercel.json. Vercel reads vercel.ts when @vercel/config is installed.
// (Install once you connect the Vercel project: `pnpm add -D @vercel/config -w`.)

import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "pnpm turbo run build --filter=@peptide/web",
  installCommand: "pnpm install --frozen-lockfile",
  outputDirectory: "apps/web/.next",
  // Crons land in later phases — placeholder list documents what we'll wire.
  crons: [
    // { path: "/api/cron/safety-scan",        schedule: "*/15 * * * *" },
    // { path: "/api/cron/projection-refresh", schedule: "0 3 * * *" },
    // { path: "/api/cron/daily-insights",     schedule: "0 9 * * *" },
  ],
};
