import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";

// Records that the user cleared the consent + 18+ age gate. The full gate UI
// (ConsentGate) is the first onboarding step; this stamps the existing
// profiles.educational_consent_at column. Idempotent — re-posting just
// refreshes the timestamp.
export async function POST() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();

    const { error, data } = await supabase
      .from("profiles")
      .update({ educational_consent_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .select("educational_consent_at")
      .single();

    if (error) throw error;
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}
