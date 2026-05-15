import { profileStepSchema } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, profileStepSchema);
    const supabase = await createSupabaseServerClient();

    const { error, data: row } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          display_name: data.display_name,
          dob: data.dob.toISOString().slice(0, 10),
          sex: data.sex,
          height_in: data.height_in,
          unit_weight: data.unit_weight,
          unit_length: data.unit_length,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) throw error;
    return jsonOk(row);
  } catch (err) {
    return jsonError(err);
  }
}
