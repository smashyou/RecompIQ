import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";
import { AppError } from "@peptide/shared";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();

    // Refuse to complete if required steps are missing.
    const [profile, goal] = await Promise.all([
      supabase.from("profiles").select("display_name,sex,height_in").eq("user_id", user.id).maybeSingle(),
      supabase.from("goals").select("id").eq("user_id", user.id).maybeSingle(),
    ]);

    if (!profile.data?.display_name || !profile.data.height_in) {
      throw new AppError("VALIDATION_FAILED", "Profile step not completed");
    }
    if (!goal.data) {
      throw new AppError("VALIDATION_FAILED", "Goal step not completed");
    }

    const { error, data } = await supabase
      .from("profiles")
      .update({ onboarding_done: true })
      .eq("user_id", user.id)
      .select("onboarding_done")
      .single();

    if (error) throw error;
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}
