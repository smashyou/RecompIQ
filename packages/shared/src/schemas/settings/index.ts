import { z } from "zod";

/**
 * Notification preferences. `notification_channel` governs how reminders +
 * summaries are delivered; the per-type booleans gate which ones. Transactional
 * + auth emails ignore all of this and always send.
 */
export const NOTIFICATION_CHANNELS = ["in_app", "email", "both", "off"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const notificationSettingsSchema = z.object({
  notification_channel: z.enum(NOTIFICATION_CHANNELS),
  notify_weekly_summary: z.boolean(),
  notify_body_shot: z.boolean(),
  notify_dose_reminders: z.boolean(),
  notify_weighin_reminder: z.boolean(),
  notify_safety_alerts: z.boolean(),
});
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

/** Partial — for PATCH-style updates from the settings form. */
export const notificationSettingsUpdateSchema = notificationSettingsSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
export type NotificationSettingsUpdate = z.infer<typeof notificationSettingsUpdateSchema>;

/** Sensible defaults (mirror the DB column defaults). */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notification_channel: "both",
  notify_weekly_summary: true,
  notify_body_shot: true,
  notify_dose_reminders: true,
  notify_weighin_reminder: true,
  notify_safety_alerts: true,
};

export function emailEnabled(channel: NotificationChannel): boolean {
  return channel === "email" || channel === "both";
}
export function inAppEnabled(channel: NotificationChannel): boolean {
  return channel === "in_app" || channel === "both";
}

export type ReminderKind = "weekly_summary" | "body_shot" | "dose" | "weigh_in" | "safety";

/**
 * Should we email this reminder to a user with these settings? Used by the
 * (future) reminder cron/senders before calling sendEmail(). Transactional
 * emails do NOT go through this.
 */
export function shouldEmailReminder(
  s: Pick<NotificationSettings, "notification_channel"> & Partial<NotificationSettings>,
  kind: ReminderKind,
): boolean {
  if (!emailEnabled(s.notification_channel)) return false;
  switch (kind) {
    case "weekly_summary":
      return s.notify_weekly_summary ?? true;
    case "body_shot":
      return s.notify_body_shot ?? true;
    case "dose":
      return s.notify_dose_reminders ?? true;
    case "weigh_in":
      return s.notify_weighin_reminder ?? true;
    case "safety":
      return s.notify_safety_alerts ?? true;
  }
}
