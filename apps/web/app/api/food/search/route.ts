import { searchFood } from "@peptide/nutrition";
import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api";
import { AppError } from "@peptide/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    if (!q) throw new AppError("VALIDATION_FAILED", "Missing query parameter `q`");
    const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
    const results = await searchFood({ query: q, limit });
    return jsonOk({ query: q, results });
  } catch (err) {
    return jsonError(err);
  }
}
