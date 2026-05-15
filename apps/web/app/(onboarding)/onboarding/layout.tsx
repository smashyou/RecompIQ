import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/signin");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_done")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.onboarding_done) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 py-4 text-center text-xs uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
        Educational tracking. Not medical advice.
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
