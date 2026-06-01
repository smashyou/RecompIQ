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
  FlaskRound,
  GanttChartSquare,
  Home,
  Library,
  MessageCircle,
  Settings,
  Shield,
  Syringe,
  Target,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/log", label: "Quick log", icon: ClipboardList },
  { href: "/food", label: "Food", icon: Utensils },
  { href: "/peptides", label: "Peptides", icon: Syringe },
  { href: "/peptides/library", label: "Protocol Library", icon: Library },
  { href: "/peptides/protocols", label: "Protocols", icon: FlaskRound },
  { href: "/peptides/inventory", label: "Inventory & spend", icon: Wallet },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/body-shots", label: "Body shots", icon: Camera },
  { href: "/projections", label: "Projections", icon: BarChart3 },
  { href: "/timeline", label: "Timeline", icon: GanttChartSquare },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/labs", label: "Labs", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Admin-only entry, appended to the nav for users with profiles.is_admin.
export const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin", icon: Shield };

export const BRAND = { href: "/dashboard", label: "RecompIQ", icon: Activity };

// Active = the nav item whose href is the LONGEST prefix of the current path,
// so /peptides and /peptides/protocols don't both highlight.
function activeHrefFor(items: NavItem[], pathname: string): string {
  return items.reduce<string>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return matches && item.href.length > best.length ? item.href : best;
  }, "");
}

export function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;
  const activeHref = activeHrefFor(items, pathname);
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-[var(--r-md)] px-3 py-[9px] text-[13.5px] transition-colors",
              active
                ? "bg-[var(--primary-wash)] font-semibold text-[var(--primary-bright)]"
                : "font-medium text-[var(--fg-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--fg)]",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-[3px] rounded-[3px] bg-[var(--primary)]"
              />
            )}
            <Icon size={18} strokeWidth={active ? 2 : 1.75} className="shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="min-w-4 rounded-[var(--r-pill)] bg-[var(--danger)] px-1.5 py-px text-center font-[family-name:var(--font-mono)] text-[10px] font-semibold text-[var(--danger-foreground)]">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
