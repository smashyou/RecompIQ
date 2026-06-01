import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ToastProvider } from "@/components/ui/toast";

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
      <div className="flex min-h-screen">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex flex-1 flex-col">
          <Topbar email={user.email ?? ""} isAdmin={isAdmin} />
          <main className="flex-1 px-6 py-6">
            <div className="mx-auto w-full max-w-[1120px]">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
