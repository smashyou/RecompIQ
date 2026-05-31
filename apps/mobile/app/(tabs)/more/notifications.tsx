import { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_CHANNELS,
  emailEnabled,
  type NotificationChannel,
  type NotificationSettings,
} from "@peptide/shared";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Content } from "@/components/ui/Content";
import { Segmented } from "@/components/ui/Segmented";
import { Loading } from "@/components/ui/States";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";

const COLUMNS =
  "notification_channel, notify_weekly_summary, notify_body_shot, notify_dose_reminders, notify_weighin_reminder, notify_safety_alerts";

const CHANNEL_OPTIONS: ReadonlyArray<{ value: NotificationChannel; label: string }> = [
  { value: "in_app", label: "In-app" },
  { value: "email", label: "Email" },
  { value: "both", label: "Both" },
  { value: "off", label: "Off" },
];

const REMINDERS: { key: keyof NotificationSettings; label: string; hint: string }[] = [
  { key: "notify_weekly_summary", label: "Weekly progress summary", hint: "Your week in review, once a week." },
  { key: "notify_dose_reminders", label: "Protocol reminders", hint: "A daily nudge for what you scheduled." },
  { key: "notify_weighin_reminder", label: "Weigh-in reminder", hint: "Morning weigh-in, same time each day." },
  { key: "notify_body_shot", label: "Progress photo reminder", hint: "When your next photo set is due." },
  { key: "notify_safety_alerts", label: "Safety alerts", hint: "Flags from your logged data." },
];

export default function Notifications() {
  const { session } = useSession();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.user.id) return;
    supabase
      .from("user_settings")
      .select(COLUMNS)
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) =>
        setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...(data ?? {}) } as NotificationSettings),
      );
  }, [session?.user.id]);

  if (!settings) return <Loading />;

  const isOff = settings.notification_channel === "off";
  const sendsEmail = emailEnabled(settings.notification_channel);

  function set<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function save() {
    if (!session?.user.id || !settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: session.user.id, ...settings }, { onConflict: "user_id" });
    setSaving(false);
    if (error) Alert.alert("Couldn't save", error.message);
    else Alert.alert("Saved", "Notification preferences updated.");
  }

  return (
    <Content className="gap-4">
      <Text className="text-sm text-muted-foreground">
        Pick how reminders reach you, and which ones. Account emails (welcome,
        security, data exports) always send.
      </Text>

      <Card className="gap-3 p-4">
        <Text className="text-sm font-semibold text-foreground">Delivery</Text>
        <Segmented
          fill
          options={CHANNEL_OPTIONS}
          value={settings.notification_channel}
          onChange={(v) => set("notification_channel", v)}
        />
        <Text className="text-xs text-muted-foreground">
          {isOff
            ? "All reminders are paused. Account emails still send."
            : !sendsEmail
              ? "Reminders show in the app only — no reminder emails."
              : settings.notification_channel === "both"
                ? "Reminders delivered in-app and by email."
                : "Reminders delivered by email."}
        </Text>
      </Card>

      <Card className="p-0">
        <Text className="border-b border-border p-4 text-sm font-semibold text-foreground">
          Which reminders
        </Text>
        {REMINDERS.map((r, i) => (
          <View
            key={r.key}
            className={`flex-row items-center gap-3 p-4 ${i < REMINDERS.length - 1 ? "border-b border-border" : ""}`}
          >
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">{r.label}</Text>
              <Text className="text-xs text-muted-foreground">{r.hint}</Text>
            </View>
            <Switch
              value={Boolean(settings[r.key])}
              disabled={isOff}
              onValueChange={(v) => set(r.key, v)}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>
        ))}
      </Card>

      <Button title={saving ? "Saving…" : "Save preferences"} onPress={save} loading={saving} />
    </Content>
  );
}
