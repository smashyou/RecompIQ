import { stackInput, AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("peptide_stacks")
      .select("*, peptide_stack_items(*, compounds(slug,name,evidence_level,fda_approved))")
      .eq("id", id)
      .single();
    if (error || !data) throw new AppError("NOT_FOUND", "Stack not found");
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}

// Full replace: updates stack fields and replaces all items.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const data = await parseJson(req, stackInput);
    const supabase = await createSupabaseServerClient();

    const { error: updErr } = await supabase
      .from("peptide_stacks")
      .update({
        name: data.name,
        phase: data.phase ?? null,
        started_on: data.started_on ? data.started_on.toISOString().slice(0, 10) : null,
        notes: data.notes ?? null,
        is_active: data.is_active,
      })
      .eq("id", id);
    if (updErr) throw updErr;

    // Replace items (RLS gates both operations to the owner).
    const { error: delErr } = await supabase
      .from("peptide_stack_items")
      .delete()
      .eq("stack_id", id);
    if (delErr) throw delErr;

    const items = data.items.map((i) => ({
      stack_id: id,
      user_id: user.id,
      compound_id: i.compound_id,
      dose_value: i.dose_value,
      dose_unit: i.dose_unit,
      route: i.route,
      frequency: i.frequency,
      notes: i.notes ?? null,
    }));
    const { error: insErr } = await supabase.from("peptide_stack_items").insert(items);
    if (insErr) throw insErr;

    return jsonOk({ stack_id: id });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("peptide_stacks").delete().eq("id", id);
    if (error) throw error;
    return jsonOk({ id, deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
