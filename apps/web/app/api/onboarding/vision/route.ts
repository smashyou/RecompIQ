import { visionStepSchema } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { vision_provider } = await parseJson(req, visionStepSchema);
    const supabase = await createSupabaseServerClient();

    const { error, data } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, vision_provider }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}
