import { notificationSettingsUpdateSchema } from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError, parseJson } from "@/lib/api";

export const runtime = "nodejs";

const COLUMNS =
  "notification_channel, notify_weekly_summary, notify_body_shot, notify_dose_reminders, notify_weighin_reminder, notify_safety_alerts";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const patch = await parseJson(req, notificationSettingsUpdateSchema);
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
      .select(COLUMNS)
      .single();

    if (error) throw error;
    return jsonOk(data);
  } catch (err) {
    return jsonError(err);
  }
}
