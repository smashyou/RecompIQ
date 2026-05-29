// Phase 11: photo food logging — single-asset fetch + delete.
// GET returns the asset row including parsed_items (no re-fetch of suggestions).
// DELETE best-effort removes the Blob then the row; mirrors body-shots cleanup.

import { del } from "@vercel/blob";
import { AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("food_photo_assets")
      .select(
        "id, blob_url, mime_type, size_bytes, vision_provider, vision_model, parsed_items, parsed_at, parse_error, confirmed_at, created_at",
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new AppError("NOT_FOUND", "Photo asset not found");
    }
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const { data: asset, error: loadErr } = await supabase
      .from("food_photo_assets")
      .select("id, blob_url")
      .eq("id", id)
      .single();

    if (loadErr || !asset) {
      throw new AppError("NOT_FOUND", "Photo asset not found");
    }

    // Best-effort Blob cleanup. If the token is missing or the blob is already
    // gone, fall through and delete the row anyway so the UI stays consistent.
    if (process.env.BLOB_READ_WRITE_TOKEN && asset.blob_url) {
      try {
        await del(asset.blob_url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch {
        /* swallow */
      }
    }

    const { error: delErr } = await supabase
      .from("food_photo_assets")
      .delete()
      .eq("id", id);

    if (delErr) throw delErr;

    return jsonOk({ id, deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
