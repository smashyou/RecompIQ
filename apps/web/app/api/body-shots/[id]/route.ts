import { del } from "@vercel/blob";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();

    const { data: row } = await supabase
      .from("body_photos")
      .select("front_url,back_url,left_url,right_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    // Best-effort Blob cleanup. RLS prevents a wrong-user delete from finding the row at all.
    if (row && process.env.BLOB_READ_WRITE_TOKEN) {
      const urls = [row.front_url, row.back_url, row.left_url, row.right_url]
        .filter((u): u is string => Boolean(u));
      for (const url of urls) {
        try {
          await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
        } catch {
          // ignore — DB row is the source of truth, orphan Blob is acceptable
        }
      }
    }

    const { error } = await supabase
      .from("body_photos")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
