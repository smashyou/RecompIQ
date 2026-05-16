import { doseLogInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, doseLogInput);
    const takenAt = data.taken_at ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { data: row, error } = await supabase
      .from("peptide_doses")
      .insert({
        user_id: user.id,
        stack_item_id: data.stack_item_id ?? null,
        compound_id: data.compound_id,
        taken_at: takenAt.toISOString(),
        dose_value: data.dose_value,
        dose_unit: data.dose_unit,
        route: data.route,
        injection_site: data.injection_site ?? null,
        adherence: data.adherence,
        side_effects: data.side_effects ?? [],
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("peptide_doses")
      .select("*, compounds(slug,name)")
      .eq("user_id", user.id)
      .order("taken_at", { ascending: false })
      .limit(200);
    if (fromParam) query = query.gte("taken_at", `${fromParam}T00:00:00`);
    if (toParam) query = query.lte("taken_at", `${toParam}T23:59:59.999`);
    const { data, error } = await query;
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}
