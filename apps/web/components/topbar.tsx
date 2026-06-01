"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, LogOut, Search } from "lucide-react";
import { MobileNav } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function initialsFor(email: string): string {
  const handle = email.split("@")[0] ?? "";
  const parts = handle.split(/[.\-_]+/).filter(Boolean);
  const letters =
    (parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : handle.slice(0, 2)) || "RX";
  return letters.toUpperCase();
}

export function Topbar({
  email,
  title = "RecompIQ",
  isAdmin,
}: {
  email: string;
  title?: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center gap-4 border-b border-border px-6 backdrop-blur-md [background:color-mix(in_oklab,var(--bg)_80%,transparent)]">
      <MobileNav isAdmin={isAdmin} />
      <h1 className="font-[family-name:var(--font-display)] text-[18px] font-semibold tracking-[-0.015em] text-[var(--fg)]">
        {title}
      </h1>

      <div className="ml-2 hidden max-w-[380px] flex-1 md:block">
        <span className="flex h-9 items-center gap-[9px] rounded-[var(--r-md)] border border-border bg-[var(--surface-1)] px-3 text-[var(--fg-subtle)]">
          <Search size={15} className="shrink-0" />
          <span className="truncate text-[13px]">Search compounds, logs, labs…</span>
          <span className="ml-auto rounded-[4px] border border-border px-[5px] py-px font-[family-name:var(--font-mono)] text-[11px]">
            ⌘K
          </span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <ThemeToggle compact />
        <Link
          href="/alerts"
          aria-label="Alerts"
          className="relative grid h-9 w-9 place-items-center rounded-[var(--r-md)] border border-border text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--fg)]"
        >
          <Bell size={16} />
          <span className="absolute right-2 top-[7px] h-[7px] w-[7px] rounded-full bg-[var(--danger)] shadow-[0_0_0_2px_var(--bg)]" />
        </Link>
        <button
          type="button"
          onClick={signOut}
          title={`${email} · Sign out`}
          aria-label="Sign out"
          className="group relative grid h-[34px] w-[34px] place-items-center rounded-full font-[family-name:var(--font-display)] text-[13px] font-semibold text-[var(--primary-foreground)] [background:linear-gradient(150deg,var(--primary),var(--positive))]"
        >
          <span className="group-hover:opacity-0">{initialsFor(email)}</span>
          <LogOut size={15} className="absolute opacity-0 group-hover:opacity-100" />
        </button>
      </div>
    </header>
  );
}
