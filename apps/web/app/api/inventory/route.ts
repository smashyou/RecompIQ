import { peptidePurchaseInput } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List the user's purchases.
export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("peptide_purchases")
      .select("*, compounds(slug,name)")
      .eq("user_id", user.id)
      .order("purchased_on", { ascending: false });
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}

// Log a purchase.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, peptidePurchaseInput);
    const supabase = await createSupabaseServerClient();
    const { data: row, error } = await supabase
      .from("peptide_purchases")
      .insert({
        user_id: user.id,
        compound_id: data.compound_id,
        vial_mg: data.vial_mg,
        vial_count: data.vial_count,
        price_usd: data.price_usd,
        vendor: data.vendor ?? null,
        purchased_on: (data.purchased_on ?? new Date()).toISOString().slice(0, 10),
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return jsonOk({ id: row.id });
  } catch (err) {
    return jsonError(err);
  }
}
