"use client";

import Link from "next/link";
import { BRAND, NavLinks } from "@/components/nav";
import { Wordmark } from "@/components/wordmark";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start border-r border-border bg-[var(--bg)] md:flex">
      <div className="flex h-[60px] shrink-0 items-center border-b border-border px-[18px]">
        <Link href={BRAND.href} aria-label={BRAND.label}>
          <Wordmark size={19} />
        </Link>
      </div>
      <NavLinks />
      <div className="shrink-0 border-t border-border p-3">
        <SafetyDisclaimer variant="compact" />
      </div>
    </aside>
  );
}
