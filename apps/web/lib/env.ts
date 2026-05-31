import { z } from "zod";

// Treat empty strings as missing for optional vars (so `FOO=` in .env behaves like absent).
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // New Supabase API key names (publishable replaces anon; secret replaces
  // service_role). Values are `sb_publishable_…` / `sb_secret_…`.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: optionalString,
  AI_GATEWAY_API_KEY: optionalString,
  RESEND_API_KEY: optionalString,
  SEND_EMAIL_HOOK_SECRET: optionalString,
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ENABLE_DEMO: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export const serverEnv = serverEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SEND_EMAIL_HOOK_SECRET: process.env.SEND_EMAIL_HOOK_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ENABLE_DEMO: process.env.NEXT_PUBLIC_ENABLE_DEMO,
});

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: serverEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: serverEnv.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ENABLE_DEMO: serverEnv.NEXT_PUBLIC_ENABLE_DEMO,
};
