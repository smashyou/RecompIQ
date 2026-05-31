import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DoseLogger } from "./logger";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { SectionHeader, Overline } from "@/components/kit";

export const dynamic = "force-dynamic";

interface StackItem {
  id: string;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency: string;
  compound_id: string;
  compounds: { slug: string; name: string };
}

interface DoseRow {
  id: string;
  taken_at: string;
  dose_value: number;
  dose_unit: string;
  route: string;
  injection_site: string | null;
  adherence: string;
  compounds: { slug: string; name: string } | null;
}

export default async function DoseLogPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [itemsRes, dosesRes] = await Promise.all([
    supabase
      .from("peptide_stack_items")
      .select(
        "id,dose_value,dose_unit,route,frequency,compound_id, compounds(slug,name), peptide_stacks!inner(is_active)",
      )
      .eq("user_id", user.id)
      .eq("peptide_stacks.is_active", true),
    supabase
      .from("peptide_doses")
      .select("id,taken_at,dose_value,dose_unit,route,injection_site,adherence, compounds(slug,name)")
      .eq("user_id", user.id)
      .gte("taken_at", fourteenDaysAgo.toISOString())
      .order("taken_at", { ascending: false })
      .limit(60),
  ]);

  const items = ((itemsRes.data ?? []) as unknown as StackItem[]).filter(
    (i) => i.compounds,
  );
  const doses = (dosesRes.data ?? []) as unknown as DoseRow[];

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader title="Dose log" note="last 14 days" />
      <p className="mb-6 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Tap a compound from your active stack to log today&apos;s dose at the schedule you set.
      </p>

      <DoseLogger items={items} />

      <section className="mt-6 space-y-2">
        <Overline>Last 14 days</Overline>
        {doses.length === 0 ? (
          <p className="rounded-[var(--r-md)] border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-6 text-center font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-subtle)]">
            No doses logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)]">
            {doses.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-[family-name:var(--font-sans)] text-[13.5px] font-medium text-[var(--fg)]">
                    {d.compounds?.name ?? "Unknown"}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                    {new Date(d.taken_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {d.injection_site ? ` · ${d.injection_site}` : ""}
                    {d.adherence !== "taken" ? ` · ${d.adherence}` : ""}
                  </p>
                </div>
                <p className="text-right font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--fg)]">
                  {Number(d.dose_value)} {d.dose_unit}{" "}
                  <span className="text-[11px] uppercase text-[var(--fg-subtle)]">{d.route}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <SafetyDisclaimer variant="compact" />
      </div>
    </div>
  );
}
