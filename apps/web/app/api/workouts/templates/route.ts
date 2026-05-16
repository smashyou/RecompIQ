import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const phase = url.searchParams.get("phase");
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("workout_templates")
      .select("slug,name,phase,session_type,description,exercises")
      .order("phase")
      .order("name");
    if (phase) query = query.eq("phase", phase);
    const { data, error } = await query;
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}
