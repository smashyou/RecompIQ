import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/kit";
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
    <div className="mx-auto flex max-w-2xl flex-col gap-[18px]">
      <SectionHeader
        num="09"
        title={templateRes.data ? templateRes.data.name : "New workout session"}
        note={templateRes.data?.description ?? undefined}
      />
      <Suspense fallback={null}>
        <NewWorkoutForm template={templateRes.data} userPhase={userPhase} />
      </Suspense>
    </div>
  );
}
