"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/mobile-nav";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function Topbar({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/signin");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNav />
        <span className="truncate text-sm text-[var(--color-muted-foreground)]">
          Educational tracking. Not medical advice.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-[var(--color-muted-foreground)] md:inline">
          {email}
        </span>
        <Button onClick={signOut} variant="ghost" size="sm">
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
