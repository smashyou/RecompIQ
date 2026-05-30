"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BRAND, NavLinks } from "@/components/nav";

// Hamburger + slide-out drawer for screens below md, where the desktop sidebar
// is hidden. Closes on route change and on backdrop / link tap.
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const BrandIcon = BRAND.icon;

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          {/* drawer */}
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-background)]">
            <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
              <Link href={BRAND.href} className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <BrandIcon className="h-5 w-5 text-[var(--color-primary)]" />
                <span className="text-sm font-semibold tracking-tight">{BRAND.label}</span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
