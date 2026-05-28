"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Camera,
  ClipboardList,
  Dumbbell,
  FlaskConical,
  Home,
  MessageCircle,
  Settings,
  Syringe,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

// Sidebar items live inside the client component so we don't ship lucide
// function references across the server→client boundary (Next 15 forbids it).
interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/log", label: "Quick log", icon: ClipboardList },
  { href: "/food", label: "Food", icon: Utensils },
  { href: "/peptides", label: "Peptides", icon: Syringe },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/body-shots", label: "Body shots", icon: Camera },
  { href: "/projections", label: "Projections", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/labs", label: "Labs", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

const BRAND = {
  href: "/dashboard",
  label: "RecompIQ",
  icon: Activity,
};

export function Sidebar() {
  const pathname = usePathname();
  const BrandIcon = BRAND.icon;
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--color-border)] md:block">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border)] px-4">
        <BrandIcon className="h-5 w-5 text-[var(--color-primary)]" />
        <Link href={BRAND.href} className="text-sm font-semibold tracking-tight">
          {BRAND.label}
        </Link>
      </div>
      <nav className="space-y-1 p-3 text-sm">
        {ITEMS.map((item) => {
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
