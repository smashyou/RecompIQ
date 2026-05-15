import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const [profile, goal, conditions, medications, injuries, settings] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("conditions").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("medications").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("injuries").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    return jsonOk({
      onboarding_done: profile.data?.onboarding_done ?? false,
      profile: profile.data ?? null,
      goal: goal.data ?? null,
      conditions: conditions.data ?? [],
      medications: medications.data ?? [],
      injuries: injuries.data ?? [],
      settings: settings.data ?? null,
    });
  } catch (err) {
    return jsonError(err);
  }
}
