import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("compounds")
      .select("*")
      .order("name");
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}
