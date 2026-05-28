import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionInput = z
  .object({
    captured_at: z.coerce.date().default(() => new Date()),
    front_url: z.string().url().nullable().optional(),
    back_url: z.string().url().nullable().optional(),
    left_url: z.string().url().nullable().optional(),
    right_url: z.string().url().nullable().optional(),
    weight_at_capture_lb: z.number().min(50).max(800).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) => Boolean(v.front_url || v.back_url || v.left_url || v.right_url),
    { message: "Provide at least one angle URL" },
  );

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("body_photos")
      .select(
        "id,captured_at,front_url,back_url,left_url,right_url,weight_at_capture_lb,notes,is_demo",
      )
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return jsonOk(data ?? []);
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const data = await parseJson(req, sessionInput);
    const capturedAt = data.captured_at ?? new Date();
    const supabase = await createSupabaseServerClient();
    const { data: row, error } = await supabase
      .from("body_photos")
      .insert({
        user_id: user.id,
        captured_at: capturedAt.toISOString(),
        front_url: data.front_url ?? null,
        back_url: data.back_url ?? null,
        left_url: data.left_url ?? null,
        right_url: data.right_url ?? null,
        weight_at_capture_lb: data.weight_at_capture_lb ?? null,
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
