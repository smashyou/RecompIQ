import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Service-role (secret-key) Supabase client. Bypasses RLS — use ONLY in trusted
 * server contexts that legitimately act across users or outside a user session:
 *   - the reminder cron (reads all opted-in users)
 *   - account deletion (auth.admin.deleteUser)
 * Never expose this to the browser. Throws if the secret key isn't configured.
 */
let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (!serverEnv.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not set — admin client unavailable.");
  }
  cached ??= createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}
