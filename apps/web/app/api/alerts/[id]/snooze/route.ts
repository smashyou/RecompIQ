import { alertSnoozeInput, type AlertSnoozeInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { days } = (await parseJson(req, alertSnoozeInput)) as AlertSnoozeInput;
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("alerts")
      .update({ snoozed_until: until })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;
    return jsonOk({ id, snoozed_until: until });
  } catch (err) {
    return jsonError(err);
  }
}
