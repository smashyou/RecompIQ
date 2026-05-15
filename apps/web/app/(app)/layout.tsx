import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  ClipboardList,
  Dumbbell,
  FlaskConical,
  Home,
  MessageCircle,
  Settings,
  Syringe,
  Utensils,
} from "lucide-react";
import { getServerUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar, type SidebarItem } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ToastProvider } from "@/components/ui/toast";

const items: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/coach", label: "Coach", icon: MessageCircle },
  { href: "/log", label: "Quick log", icon: ClipboardList },
  { href: "/food", label: "Food", icon: Utensils },
  { href: "/peptides", label: "Peptides", icon: Syringe },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/projections", label: "Projections", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/labs", label: "Labs", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/signin");

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_done")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.onboarding_done) redirect("/onboarding");

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar
          items={items}
          brand={{ href: "/dashboard", label: "Peptide Agent", icon: Activity }}
        />
        <div className="flex flex-1 flex-col">
          <Topbar email={user.email ?? ""} />
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
