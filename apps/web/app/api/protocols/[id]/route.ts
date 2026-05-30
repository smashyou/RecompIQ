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
      .from("protocol_schedules")
      .select(
        "*, protocol_schedule_weeks(*, compounds(slug,name,evidence_level,fda_approved))",
      )
      .eq("id", id)
      .single();
    if (error || !data) throw new AppError("NOT_FOUND", "Protocol schedule not found");
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
    // RLS gates to owner; weeks cascade via FK.
    const { error } = await supabase.from("protocol_schedules").delete().eq("id", id);
    if (error) throw error;
    return jsonOk({ id, deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
