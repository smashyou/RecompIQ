"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <header className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-6">
      <span className="text-sm text-[var(--color-muted-foreground)]">
        Educational tracking. Not medical advice.
      </span>
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
