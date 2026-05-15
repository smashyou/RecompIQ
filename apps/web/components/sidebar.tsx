"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarProps {
  items: SidebarItem[];
  brand: { href: string; label: string; icon: LucideIcon };
}

export function Sidebar({ items, brand }: SidebarProps) {
  const pathname = usePathname();
  const BrandIcon = brand.icon;
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] md:block">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-4">
        <BrandIcon className="h-5 w-5 text-[var(--color-primary)]" />
        <Link href={brand.href} className="text-sm font-semibold tracking-tight">
          {brand.label}
        </Link>
      </div>
      <nav className="space-y-1 p-3 text-sm">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                active
                  ? "bg-[var(--color-muted)] text-[var(--color-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
