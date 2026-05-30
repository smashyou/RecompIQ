"use client";

import Link from "next/link";
import { BRAND, NavLinks } from "@/components/nav";

export function Sidebar() {
  const BrandIcon = BRAND.icon;
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] md:block">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-4">
        <BrandIcon className="h-5 w-5 text-[var(--color-primary)]" />
        <Link href={BRAND.href} className="text-sm font-semibold tracking-tight">
          {BRAND.label}
        </Link>
      </div>
      <NavLinks />
    </aside>
  );
}
