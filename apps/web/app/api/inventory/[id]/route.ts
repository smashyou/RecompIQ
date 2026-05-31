import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("peptide_purchases")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return jsonOk({ id, deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
