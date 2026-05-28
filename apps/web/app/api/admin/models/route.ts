import { requireAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createSupabaseServerClient();
    const [providersRes, modelsRes] = await Promise.all([
      supabase.from("ai_providers").select("*").eq("active", true).order("name"),
      supabase
        .from("ai_models")
        .select("*, ai_providers(slug,kind,env_key_var)")
        .eq("active", true)
        .order("modality")
        .order("display_name"),
    ]);
    return jsonOk({
      providers: providersRes.data ?? [],
      models: modelsRes.data ?? [],
    });
  } catch (err) {
    return jsonError(err);
  }
}
