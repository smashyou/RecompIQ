import Link from "next/link";
import { Beaker, Calculator, FlaskRound, Plus, Syringe } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
import { evaluateContraindications } from "@peptide/peptides";

export const dynamic = "force-dynamic";

interface StackItemRow {
  id: string;
  dose_value: number;
  dose_unit: string;
  route: string;
  frequency: string;
  notes: string | null;
  compounds: {
    slug: string;
    name: string;
    evidence_level: string;
    fda_approved: boolean;
    absolute_contraindications?: string[];
    relative_contraindications?: string[];
  };
}

interface StackRow {
  id: string;
  name: string;
  phase: string | null;
  started_on: string | null;
  is_active: boolean;
  peptide_stack_items: StackItemRow[];
}

export default async function PeptidesPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [stacksRes, conditionsRes, medicationsRes, compoundsRes] = await Promise.all([
    supabase
      .from("peptide_stacks")
      .select(
        "id,name,phase,started_on,is_active, peptide_stack_items(id,dose_value,dose_unit,route,frequency,notes, compounds(slug,name,evidence_level,fda_approved))",
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase.from("conditions").select("name").eq("user_id", user.id).eq("active", true),
    supabase.from("medications").select("name").eq("user_id", user.id).eq("active", true),
    supabase
      .from("compounds")
      .select("slug,name,absolute_contraindications,relative_contraindications"),
  ]);

  const stacks = (stacksRes.data ?? []) as unknown as StackRow[];
  const conditions = (conditionsRes.data ?? []).map((c) => c.name as string);
  const medications = (medicationsRes.data ?? []).map((m) => m.name as string);
  const compounds = compoundsRes.data ?? [];

  // Compute contraindications across all stack compounds
  const slugsInStacks = new Set(
    stacks.flatMap((s) => s.peptide_stack_items.map((i) => i.compounds.slug)),
  );
  const allFindings = compounds
    .filter((c) => slugsInStacks.has(c.slug as string))
    .flatMap((c) =>
      evaluateContraindications(
        {
          slug: c.slug as string,
          name: c.name as string,
          absolute_contraindications: (c.absolute_contraindications as string[]) ?? [],
          relative_contraindications: (c.relative_contraindications as string[]) ?? [],
        },
        { conditions, medications, age: null },
      ),
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Peptides</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Track stacks and doses you or your clinician have decided on. RecompIQ does not
            prescribe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/peptides/compounds">
              <Beaker className="h-4 w-4" /> Catalog
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/peptides/reconstitution">
              <Calculator className="h-4 w-4" /> Reconstitution
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/peptides/dose-log">
              <Syringe className="h-4 w-4" /> Log dose
            </Link>
          </Button>
          <Button asChild>
            <Link href="/peptides/stacks/new">
              <Plus className="h-4 w-4" /> New stack
            </Link>
          </Button>
        </div>
      </header>

      {allFindings.length > 0 && <ContraindicationBanner findings={allFindings} />}

      {stacks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <FlaskRound className="mx-auto mb-3 h-8 w-8 text-[var(--color-muted-foreground)]" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No active stacks. Create one from the compounds you and your clinician have decided on.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {stacks.map((stack) => (
            <div
              key={stack.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{stack.name}</h2>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {stack.phase ?? "—"} ·{" "}
                    {stack.started_on
                      ? `started ${new Date(stack.started_on).toLocaleDateString()}`
                      : "not started"}
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {stack.peptide_stack_items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.compounds.name}</p>
                        <EvidenceBadge
                          level={item.compounds.evidence_level as never}
                          fdaApproved={item.compounds.fda_approved}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {item.frequency} · {item.route}
                        {item.notes ? ` · ${item.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <p className="font-medium">
                        {Number(item.dose_value)} {item.dose_unit}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">user-supplied</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <SafetyDisclaimer />
    </div>
  );
}
