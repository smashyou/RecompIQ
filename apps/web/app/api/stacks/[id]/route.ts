import { stackInput, AppError } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cutover (Regimen redesign §4.1): `[id]` is now a regimen PHASE id.
// A "stack" maps to a regimen phase; its items are regimen_items.

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("regimen_phases")
      .select(
        "id,name,legacy_phase,starts_on,ends_on, regimen_items(id,dose_value,dose_unit,route,frequency,notes, compounds(slug,name,evidence_level,fda_approved))",
      )
      .eq("id", id)
      .single();
    if (error || !data) throw new AppError("NOT_FOUND", "Phase not found");
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}

// Full replace: updates the phase fields and replaces all its items.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const data = await parseJson(req, stackInput);
    const supabase = await createSupabaseServerClient();

    const { data: phase, error: phaseErr } = await supabase
      .from("regimen_phases")
      .select("id,regimen_id")
      .eq("id", id)
      .single();
    if (phaseErr || !phase) throw new AppError("NOT_FOUND", "Phase not found");
    const regimenId = phase.regimen_id as string;
    const startsOn = data.started_on ? data.started_on.toISOString().slice(0, 10) : null;

    const { error: updErr } = await supabase
      .from("regimen_phases")
      .update({
        name: data.name,
        legacy_phase: data.phase ?? null,
        starts_on: startsOn,
        notes: data.notes ?? null,
      })
      .eq("id", id);
    if (updErr) throw updErr;

    // Replace items (RLS gates both operations to the owner).
    const { error: delErr } = await supabase
      .from("regimen_items")
      .delete()
      .eq("phase_id", id);
    if (delErr) throw delErr;

    const items = data.items.map((i) => ({
      regimen_id: regimenId,
      phase_id: id,
      user_id: user.id,
      compound_id: i.compound_id,
      dose_value: i.dose_value,
      dose_unit: i.dose_unit,
      route: i.route,
      frequency: i.frequency,
      source: "user" as const,
      starts_on: startsOn,
      notes: i.notes ?? null,
    }));
    const { data: inserted, error: insErr } = await supabase
      .from("regimen_items")
      .insert(items)
      .select("id,compound_id,dose_value,dose_unit,route,frequency");
    if (insErr) throw insErr;

    const changeRows = (inserted ?? []).map((it) => ({
      regimen_id: regimenId,
      item_id: it.id,
      user_id: user.id,
      kind: "edit" as const,
      after: {
        compound_id: it.compound_id,
        dose_value: it.dose_value,
        dose_unit: it.dose_unit,
        route: it.route,
        frequency: it.frequency,
      },
      effective_on: startsOn ?? new Date().toISOString().slice(0, 10),
    }));
    if (changeRows.length > 0) {
      await supabase.from("regimen_changes").insert(changeRows);
    }

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
    // Deleting the phase cascades its items; change-log rows keep their history
    // (item_id set null). RLS gates to the owner.
    const { error } = await supabase.from("regimen_phases").delete().eq("id", id);
    if (error) throw error;
    return jsonOk({ id, deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
