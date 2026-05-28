import { put } from "@vercel/blob";
import { AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
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
    const angle = form.get("angle")?.toString() ?? "";
    const sessionId = form.get("session_id")?.toString() ?? "";

    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_FAILED", "Missing file field");
    }
    if (!["front", "back", "left", "right"].includes(angle)) {
      throw new AppError("VALIDATION_FAILED", "angle must be one of front/back/left/right");
    }
    if (!sessionId || !/^[0-9a-f-]{32,40}$/i.test(sessionId)) {
      throw new AppError("VALIDATION_FAILED", "session_id must be a UUID");
    }
    if (!ALLOWED.has(file.type)) {
      throw new AppError("VALIDATION_FAILED", `Unsupported image type ${file.type}`);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("VALIDATION_FAILED", "File too large (10 MB max)");
    }

    const ext = file.type === "image/heic" ? "heic" : file.type.split("/")[1] ?? "jpg";
    const pathname = `body-photos/${user.id}/${sessionId}/${angle}.${ext}`;

    const result = await put(pathname, file, {
      access: "public", // URL contains an unguessable hash; RLS gates the DB row that references it
      addRandomSuffix: true,
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return jsonOk({
      url: result.url,
      pathname: result.pathname,
      angle,
      session_id: sessionId,
    });
  } catch (err) {
    return jsonError(err);
  }
}
