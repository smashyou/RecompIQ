"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  NOTIFICATION_CHANNELS,
  emailEnabled,
  type NotificationChannel,
  type NotificationSettings,
} from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { postJson } from "@/lib/post-json";
import { cn } from "@/lib/cn";
import { Card } from "@/components/kit";

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
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

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-40",
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-muted)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function NotificationsForm({ initial }: { initial: NotificationSettings }) {
  const router = useRouter();
  const toast = useFireToast();
  const [settings, setSettings] = useState<NotificationSettings>(initial);
  const [saving, setSaving] = useState(false);

  const isOff = settings.notification_channel === "off";
  const channelSendsEmail = emailEnabled(settings.notification_channel);

  function set<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    // Auto-capture the browser's timezone so reminders fire on the user's
    // local schedule (Monday-in-their-tz, etc.).
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timezone = undefined;
    }
    const res = await postJson(
      "/api/settings/notifications",
      timezone ? { ...settings, timezone } : settings,
      router,
    );
    setSaving(false);
    if (res.ok) {
      toast.success("Notification preferences saved.");
      router.refresh();
    } else {
      toast.error(res.message ?? "Couldn't save preferences.");
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Channel */}
      <Card title="Delivery">
        <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-muted)]">
          How should reminders reach you?
        </p>
        <div
          role="radiogroup"
          aria-label="Notification channel"
          className="mt-3 inline-flex rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] p-1"
        >
          {CHANNEL_OPTIONS.map((opt) => {
            const active = settings.notification_channel === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("notification_channel", opt.value)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {isOff ? (
          <p className="mt-3 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
            All reminders are paused. Account emails (welcome, security, data
            exports) still send.
          </p>
        ) : !channelSendsEmail ? (
          <p className="mt-3 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
            Reminders show in the app only — no reminder emails will be sent.
          </p>
        ) : (
          <p className="mt-3 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
            Reminders below will be delivered by{" "}
            {settings.notification_channel === "both" ? "in-app and email" : "email"}.
          </p>
        )}
      </Card>

      {/* Per-type toggles */}
      <Card pad={0}>
        <div className="border-b border-[var(--border)] p-4">
          <h2 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--fg)]">
            Which reminders
          </h2>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {REMINDERS.map((r) => (
            <li key={r.key} className="flex items-center gap-4 p-4">
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--fg)]">
                  {r.label}
                </span>
                <span className="block font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
                  {r.hint}
                </span>
              </span>
              <Switch
                label={r.label}
                checked={Boolean(settings[r.key])}
                disabled={isOff}
                onChange={(v) => set(r.key, v)}
              />
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
