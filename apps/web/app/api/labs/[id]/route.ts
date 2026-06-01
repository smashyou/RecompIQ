// Phase 6: labs/biomarkers — delete a single reading.
// Best-effort Blob cleanup of the source report image, but only when no OTHER
// reading still references the same photo (one report → many marker rows).

import { del } from "@vercel/blob";
import { AppError } from "@peptide/shared";
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

    const { data: row, error: fetchErr } = await supabase
      .from("lab_results")
      .select("id, photo_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (fetchErr || !row) throw new AppError("NOT_FOUND", "Lab result not found");

    const { error: delErr } = await supabase
      .from("lab_results")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (delErr) throw delErr;

    // Clean the Blob only if this was the last row pointing at it.
    if (row.photo_url && process.env.BLOB_READ_WRITE_TOKEN) {
      const { count } = await supabase
        .from("lab_results")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("photo_url", row.photo_url);
      if ((count ?? 0) === 0) {
        await del(row.photo_url, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
      }
    }

    return jsonOk({ deleted: id });
  } catch (err) {
    return jsonError(err);
  }
}
