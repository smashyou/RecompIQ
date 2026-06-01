import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveRegimen } from "@/lib/queries/regimen";
import { LogTabs } from "./tabs";

export const dynamic = "force-dynamic";

// A neuro-related injury/condition surfaces the nerve-symptom self-check; any
// active regimen compound surfaces the nausea self-check. Both feed the safety
// engine's measured self-checks (never free-text).
const NEURO_RE = /neuro|foot|numb|nerve|drop/i;

export default async function LogPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const [injuriesRes, conditionsRes, regimen] = await Promise.all([
    supabase.from("injuries").select("name,detail").eq("user_id", user.id).eq("active", true),
    supabase.from("conditions").select("name,detail").eq("user_id", user.id).eq("active", true),
    loadActiveRegimen(user.id),
  ]);
  const healthText = [...(injuriesRes.data ?? []), ...(conditionsRes.data ?? [])]
    .map((r) => `${r.name ?? ""} ${r.detail ?? ""}`)
    .join(" ");
  const showNeuro = NEURO_RE.test(healthText);
  const showNausea = (regimen?.currentItems ?? []).some((i) => Boolean(i.compound));

  return (
    <div className="mx-auto max-w-narrow">
      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Quick log
        </h1>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
          Capture today&apos;s numbers in under 30 seconds.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="font-[family-name:var(--font-sans)] text-sm text-[var(--fg-subtle)]">
            Loading…
          </div>
        }
      >
        <LogTabs showNeuro={showNeuro} showNausea={showNausea} />
      </Suspense>
    </div>
  );
}
