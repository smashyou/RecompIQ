import { requireUser } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api";
import { loadActiveRegimen } from "@/lib/queries/regimen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Active regimen (phases + items + compounds) for the client drawer / refresh.
export async function GET() {
  try {
    const user = await requireUser();
    const regimen = await loadActiveRegimen(user.id);
    return jsonOk(regimen);
  } catch (err) {
    return jsonError(err);
  }
}
