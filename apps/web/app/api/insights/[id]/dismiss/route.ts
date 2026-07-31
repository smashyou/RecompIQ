import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dismiss one generated insight. Only the status changes — the guard-checked
 * text stays on the row so a dismissed insight remains an accurate record of
 * what the product actually said, which is the point of auditing this table.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("ai_insights")
      .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return jsonOk({ id, status: "dismissed" });
  } catch (err) {
    return jsonError(err);
  }
}
