"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BRAND, NavLinks } from "@/components/nav";
import { Wordmark } from "@/components/wordmark";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";

// Hamburger + slide-out drawer for screens below md, where the desktop sidebar
// is hidden. Closes on route change and on backdrop / link tap.
export function MobileNav({ isAdmin }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
        className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--fg)]"
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
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[80%] flex-col overflow-hidden border-r border-border bg-[var(--bg)]">
            <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border px-[18px]">
              <Link href={BRAND.href} aria-label={BRAND.label} onClick={() => setOpen(false)}>
                <Wordmark size={19} />
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--fg)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
            <div className="shrink-0 border-t border-border p-3">
              <SafetyDisclaimer variant="compact" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
