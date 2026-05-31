import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";

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
];

export default async function SettingsPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage how RecompIQ works for you.
        </p>
      </header>

      <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-muted)]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-primary)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block truncate text-sm text-[var(--color-muted-foreground)]">
                  {s.description}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
