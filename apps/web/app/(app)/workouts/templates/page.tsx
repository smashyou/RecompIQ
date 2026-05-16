import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TemplatesList } from "./templates-list";

export const dynamic = "force-dynamic";

interface TemplateRow {
  slug: string;
  name: string;
  phase: string;
  session_type: string;
  description: string;
  exercises: { name: string; sets?: number; reps?: number; duration_min?: number; notes?: string }[];
}

export default async function TemplatesPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const [templatesRes, goalRes] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("slug,name,phase,session_type,description,exercises")
      .order("phase")
      .order("name"),
    supabase
      .from("goals")
      .select("phase")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const templates = (templatesRes.data ?? []) as TemplateRow[];
  const userPhase = (goalRes.data?.phase as string | null) ?? "P1";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workout templates</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Phase-aware suggestions. Start a session from any template — exercises copy in and
          you can edit before saving.
        </p>
      </header>
      <TemplatesList templates={templates} userPhase={userPhase} />
    </div>
  );
}
