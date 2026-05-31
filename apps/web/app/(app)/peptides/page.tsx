import Link from "next/link";
import {
  Beaker,
  Calculator,
  ChevronRight,
  FlaskRound,
  Library,
  Plus,
  Syringe,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { SafetyDisclaimer } from "@/components/peptides/safety-disclaimer";
import { ContraindicationBanner } from "@/components/peptides/contraindication-banner";
import { Card, SectionHeader, Overline } from "@/components/kit";
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

const NAV = [
  { href: "/peptides/library", label: "Protocol library", icon: Library },
  { href: "/peptides/compounds", label: "Compound catalog", icon: Beaker },
  { href: "/peptides/protocols", label: "Reconstitution & protocols", icon: Calculator },
  { href: "/peptides/dose-log", label: "Dose log", icon: Syringe },
] as const;

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
    <div className="mx-auto max-w-[860px]">
      <SectionHeader
        num="07"
        title="Peptides"
        note="educational tracking · not prescriptive"
      />

      <p className="mb-5 font-[family-name:var(--font-sans)] text-[13px] leading-[1.55] text-[var(--fg-muted)]">
        Track stacks and doses you or your clinician have decided on. RecompIQ grades the evidence
        and flags contraindications — it does not prescribe.
      </p>

      {/* nav tiles */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-[14px] transition-colors hover:border-[var(--primary-line)]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--primary)]">
              <Icon size={17} />
            </span>
            <span className="flex-1 font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
              {label}
            </span>
            <ChevronRight
              size={16}
              className="text-[var(--fg-subtle)] transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>

      <Link
        href="/peptides/stacks/new"
        className="mb-6 inline-flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-4 py-2.5 font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--primary-bright)] transition-colors hover:bg-[var(--primary-line)]"
      >
        <Plus size={16} /> New stack
      </Link>

      {allFindings.length > 0 && (
        <div className="mb-6">
          <ContraindicationBanner findings={allFindings} />
        </div>
      )}

      {stacks.length === 0 ? (
        <Card style={{ borderStyle: "dashed" }}>
          <div className="py-6 text-center">
            <FlaskRound className="mx-auto mb-3 h-8 w-8 text-[var(--fg-subtle)]" />
            <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-muted)]">
              No active stacks. Create one from the compounds you and your clinician have decided on.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {stacks.map((stack) => (
            <Card key={stack.id} pad={0}>
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] px-[18px] py-4">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
                    {stack.name}
                  </h2>
                  {stack.phase && (
                    <span className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                      {stack.phase}
                    </span>
                  )}
                </div>
                <span className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                  {stack.started_on
                    ? `started ${new Date(stack.started_on).toLocaleDateString()}`
                    : "not started"}
                </span>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {stack.peptide_stack_items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-[18px] py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/peptides/library/${item.compounds.slug}`}
                          className="font-[family-name:var(--font-sans)] text-[13.5px] font-medium text-[var(--fg)] hover:text-[var(--primary)]"
                        >
                          {item.compounds.name}
                        </Link>
                        <EvidenceBadge
                          level={item.compounds.evidence_level as never}
                          fdaApproved={item.compounds.fda_approved}
                        />
                      </div>
                      <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                        {item.frequency} · {item.route}
                        {item.notes ? ` · ${item.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-[family-name:var(--font-mono)] text-[14px] font-medium tabular-nums text-[var(--fg)]">
                        {Number(item.dose_value)}
                        <span className="ml-1 text-[11px] text-[var(--fg-subtle)]">
                          {item.dose_unit}
                        </span>
                      </p>
                      <Overline style={{ fontSize: 9, letterSpacing: "0.07em" }}>
                        user-supplied
                      </Overline>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <SafetyDisclaimer />
      </div>
    </div>
  );
}
