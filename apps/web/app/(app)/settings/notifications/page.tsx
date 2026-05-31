import {
  DEFAULT_NOTIFICATION_SETTINGS,
  notificationSettingsSchema,
  type NotificationSettings,
} from "@peptide/shared";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationsForm } from "./notifications-form";

export const dynamic = "force-dynamic";

const COLUMNS =
  "notification_channel, notify_weekly_summary, notify_body_shot, notify_dose_reminders, notify_weighin_reminder, notify_safety_alerts";

export default async function NotificationsSettingsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("user_settings")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  // Fall back to defaults if the row/columns are missing (pre-migration safety).
  const parsed = notificationSettingsSchema.safeParse(data);
  const initial: NotificationSettings = parsed.success
    ? parsed.data
    : DEFAULT_NOTIFICATION_SETTINGS;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Pick how you want reminders delivered, and which ones. Account emails
          (welcome, security, data exports) always send.
        </p>
      </header>

      <NotificationsForm initial={initial} />
    </div>
  );
}
