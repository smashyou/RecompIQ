import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DoseLogger } from "./logger";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";

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
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dose log</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Tap a compound from your active stack to log today&apos;s dose at the schedule you set.
        </p>
      </header>

      <DoseLogger items={items} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Last 14 days
        </h2>
        {doses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
            No doses logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
            {doses.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.compounds?.name ?? "Unknown"}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
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
                <p className="text-right tabular-nums">
                  {Number(d.dose_value)} {d.dose_unit}{" "}
                  <span className="text-xs text-[var(--color-muted-foreground)]">{d.route}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SafetyDisclaimer variant="compact" />
    </div>
  );
}
