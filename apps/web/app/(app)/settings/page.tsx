import Link from "next/link";
import { Bell, ChevronRight, UserCog } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, SectionHeader } from "@/components/kit";

export const dynamic = "force-dynamic";

interface SettingsLink {
  href: string;
  title: string;
  description: string;
  icon: typeof Bell;
}

const SECTIONS: SettingsLink[] = [
  {
    href: "/settings/notifications",
    title: "Notifications",
    description: "Choose in-app, email, or both — and which reminders you get.",
    icon: Bell,
  },
  {
    href: "/settings/account",
    title: "Account",
    description: "Export your data, or permanently delete your account.",
    icon: UserCog,
  },
];

export default async function SettingsPage() {
  await requireUser();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[18px]">
      <SectionHeader title="Settings" note="Manage how RecompIQ works for you." />

      <Card pad={0}>
        <div className="divide-y divide-[var(--border)]">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-md)] border border-[var(--border)] text-[var(--primary-bright)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-[family-name:var(--font-sans)] text-[13.5px] font-semibold text-[var(--fg)]">
                    {s.title}
                  </span>
                  <span className="block truncate font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-muted)]">
                    {s.description}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
