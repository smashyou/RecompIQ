import { z } from "zod";
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
      .from("ai_conversations")
      .select("id,title,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}

const createInput = z.object({
  title: z.string().max(160).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { title } = await parseJson(req, createInput);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, title: title ?? null })
      .select()
      .single();
    if (error) throw error;
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}
