import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewWorkoutForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const user = await requireUser();
  const { template: slug } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [goalRes, templateRes] = await Promise.all([
    supabase
      .from("goals")
      .select("phase")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    slug
      ? supabase
          .from("workout_templates")
          .select("slug,name,phase,session_type,description,exercises")
          .eq("slug", slug)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const userPhase = (goalRes.data?.phase as string | null) ?? "P1";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {templateRes.data ? templateRes.data.name : "New workout session"}
        </h1>
        {templateRes.data?.description && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {templateRes.data.description}
          </p>
        )}
      </header>
      <Suspense fallback={null}>
        <NewWorkoutForm template={templateRes.data} userPhase={userPhase} />
      </Suspense>
    </div>
  );
}
