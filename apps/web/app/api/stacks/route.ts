import { stackInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("peptide_stacks")
      .select("*, peptide_stack_items(*, compounds(slug,name,evidence_level,fda_approved))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, stackInput);
    const supabase = await createSupabaseServerClient();

    const { data: stack, error: stackErr } = await supabase
      .from("peptide_stacks")
      .insert({
        user_id: user.id,
        name: data.name,
        phase: data.phase ?? null,
        started_on: data.started_on ? data.started_on.toISOString().slice(0, 10) : null,
        notes: data.notes ?? null,
        is_active: data.is_active,
      })
      .select()
      .single();
    if (stackErr) throw stackErr;

    const items = data.items.map((i) => ({
      stack_id: stack.id,
      user_id: user.id,
      compound_id: i.compound_id,
      dose_value: i.dose_value,
      dose_unit: i.dose_unit,
      route: i.route,
      frequency: i.frequency,
      notes: i.notes ?? null,
    }));
    const { error: itemsErr } = await supabase.from("peptide_stack_items").insert(items);
    if (itemsErr) throw itemsErr;

    return jsonOk({ stack_id: stack.id });
  } catch (err) {
    return jsonError(err);
  }
}
