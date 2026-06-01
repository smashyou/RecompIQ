// Phase 6: labs/biomarkers — upload step.
// Multipart POST → puts a lab-report image or PDF in Vercel Blob → returns
// { blob_url, kind }. The client then calls /parse to OCR it. No DB row yet;
// lab_results rows are created only when the user confirms parsed values.

import { put } from "@vercel/blob";
import { AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const PDF_TYPE = "application/pdf";
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — lab PDFs can be a few pages

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

    const isPdf = file.type === PDF_TYPE;
    const isImage = IMAGE_TYPES.has(file.type);
    if (!isPdf && !isImage) {
      throw new AppError(
        "VALIDATION_FAILED",
        `Unsupported file type ${file.type}. Upload a JPEG/PNG/WebP/HEIC image or a PDF.`,
      );
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("VALIDATION_FAILED", "File too large (15 MB max)");
    }

    const ext = isPdf ? "pdf" : file.type === "image/heic" ? "heic" : file.type.split("/")[1] ?? "jpg";
    const pathname = `lab-reports/${user.id}/${ext}`;

    const result = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return jsonOk({
      blob_url: result.url,
      kind: isPdf ? ("pdf" as const) : ("image" as const),
    });
  } catch (err) {
    return jsonError(err);
  }
}
