// Phase 11: photo food logging — upload step.
// Multipart POST → puts the image in Vercel Blob → inserts a food_photo_assets
// row → returns { asset_id, blob_url } so the client can immediately call /parse.

import { put } from "@vercel/blob";
import { AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new AppError(
        "UPSTREAM_FAILED",
        "BLOB_READ_WRITE_TOKEN not configured. Add it in Vercel → Settings → Environment Variables.",
      );
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_FAILED", "Missing file field");
    }
    if (!ALLOWED.has(file.type)) {
      throw new AppError("VALIDATION_FAILED", `Unsupported image type ${file.type}`);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("VALIDATION_FAILED", "File too large (10 MB max)");
    }

    const ext = file.type === "image/heic" ? "heic" : file.type.split("/")[1] ?? "jpg";
    const pathname = `food-photos/${user.id}/${ext}`;

    const result = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const supabase = await createSupabaseServerClient();
    const { data: asset, error } = await supabase
      .from("food_photo_assets")
      .insert({
        user_id: user.id,
        blob_url: result.url,
        blob_pathname: result.pathname,
        mime_type: file.type,
        size_bytes: file.size,
      })
      .select("id, blob_url, created_at")
      .single();

    if (error) throw error;

    return jsonOk({
      asset_id: asset.id,
      blob_url: asset.blob_url,
      created_at: asset.created_at,
    });
  } catch (err) {
    return jsonError(err);
  }
}
