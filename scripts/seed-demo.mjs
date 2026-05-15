#!/usr/bin/env node
// Print instructions for seeding Demo User A into the remote Supabase project.
// We don't have the DB password in env, so the cleanest path is paste-into-Studio.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(__dirname, "..", "db/seeds/demo_user_a.sql");
const sql = await readFile(seedPath, "utf8");

const projectRef = "hbxdvqjamtutqdvxxgat";
const studioUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

console.log("\n=== Demo User A seed ===\n");
console.log(`SQL source:    ${seedPath}`);
console.log(`SQL editor:    ${studioUrl}\n`);
console.log("Steps:");
console.log("  1. Open the SQL editor link above in your browser.");
console.log("  2. Paste the contents of demo_user_a.sql.");
console.log("  3. Run. The seed is idempotent — safe to run again.\n");
console.log("After seeding, sign in at /signin with:");
console.log("  email:    demo@recompiq.app");
console.log("  password: DemoUser!2026\n");
console.log("---- SQL preview (first 30 lines) ----");
console.log(sql.split("\n").slice(0, 30).join("\n"));
console.log("---- (truncated; full file at the path above) ----\n");
