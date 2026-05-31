import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewStackForm } from "./form";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader } from "@/components/kit";

export const dynamic = "force-dynamic";

export default async function NewStackPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("compounds")
    .select("id,slug,name,evidence_level,fda_approved,typical_route")
    .order("name");
  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader title="New stack" note="doses are user-supplied" />
      <p className="mb-6 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Record the compounds + doses your clinician has approved. Doses come from you — RecompIQ
        does not prescribe.
      </p>
      <NewStackForm compounds={data ?? []} />
      <div className="mt-6">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}
