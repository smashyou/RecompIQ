import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewStackForm } from "./form";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";

export const dynamic = "force-dynamic";

export default async function NewStackPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("compounds")
    .select("id,slug,name,evidence_level,fda_approved,typical_route")
    .order("name");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New stack</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Record the compounds + doses your clinician has approved. Doses come from you — RecompIQ
          does not prescribe.
        </p>
      </header>
      <NewStackForm compounds={data ?? []} />
      <SafetyDisclaimer />
    </div>
  );
}
