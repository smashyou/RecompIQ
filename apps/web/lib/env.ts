import { z } from "zod";

// Treat empty strings as missing for optional vars (so `FOO=` in .env behaves like absent).
const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  AI_GATEWAY_API_KEY: optionalString,
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ENABLE_DEMO: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export const serverEnv = serverEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ENABLE_DEMO: process.env.NEXT_PUBLIC_ENABLE_DEMO,
});

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: serverEnv.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ENABLE_DEMO: serverEnv.NEXT_PUBLIC_ENABLE_DEMO,
};
