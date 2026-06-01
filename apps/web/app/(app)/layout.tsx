import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { SplashGate } from "@/components/splash-gate";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/signin");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_done, is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.onboarding_done) redirect("/onboarding");
  const isAdmin = Boolean(profile?.is_admin);

  return (
    <ToastProvider>
      <SplashGate />
      <div className="flex min-h-screen">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col">
          <Topbar email={user.email ?? ""} isAdmin={isAdmin} />
          <main
            className="flex-1"
            style={{ paddingInline: "var(--space-page)", paddingBlock: "var(--space-pagey)" }}
          >
            <div className="mx-auto w-full max-w-app">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
