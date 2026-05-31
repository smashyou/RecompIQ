"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calculator, ListChecks, BookOpen, CalendarRange } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReconstitutionTab } from "./reconstitution-tab";
import { ProtocolBuilderTab } from "./protocol-builder-tab";
import { CompoundReferenceTab, type ReferenceCompound } from "./compound-reference-tab";
import { TitrationTab, type ProtocolSchedule } from "./titration-tab";

interface CompoundOption {
  id: string;
  slug: string;
  name: string;
  is_blend: boolean;
  typical_vial_mg: number | null;
  component_mg: { label: string; mg: number | null }[];
  ref_dose: { low: number; high: number; unit: string } | null;
}

const TABS = [
  { id: "reconstitution", label: "Reconstitution", icon: Calculator },
  { id: "builder", label: "Protocol Builder", icon: ListChecks },
  { id: "reference", label: "Compound Reference", icon: BookOpen },
  { id: "titration", label: "Titration Schedules", icon: CalendarRange },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProtocolsHub({
  compounds,
  referenceCompounds,
  schedules,
  initialTab,
  initialCompoundId = null,
}: {
  compounds: CompoundOption[];
  referenceCompounds: ReferenceCompound[];
  schedules: ProtocolSchedule[];
  initialTab: TabId;
  initialCompoundId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>(initialTab);
  // The selected peptide is the single source of truth across every tab, mirrored
  // into the URL (?compound=slug) so it survives tab switches, page navigations,
  // and deep links from a compound's detail page.
  const [selectedId, setSelectedId] = useState<string>(initialCompoundId ?? "");

  function urlWith(params: URLSearchParams) {
    return `/peptides/protocols?${params.toString()}`;
  }

  function go(id: TabId) {
    setTab(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(urlWith(params), { scroll: false });
  }

  function selectCompound(id: string) {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    const slug = compounds.find((c) => c.id === id)?.slug;
    if (slug) params.set("compound", slug);
    else params.delete("compound");
    router.replace(urlWith(params), { scroll: false });
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {tab === "reconstitution" && (
        <ReconstitutionTab
          compounds={compounds}
          compoundId={selectedId}
          onCompoundChange={selectCompound}
        />
      )}
      {tab === "builder" && (
        <ProtocolBuilderTab compounds={compounds} defaultCompoundId={selectedId} />
      )}
      {tab === "reference" && (
        <CompoundReferenceTab
          compounds={referenceCompounds}
          selectedCompoundId={selectedId}
          onUseInCalculator={(slug) => {
            const match = compounds.find((c) => c.slug === slug);
            if (match) selectCompound(match.id);
            go("reconstitution");
          }}
        />
      )}
      {tab === "titration" && <TitrationTab schedules={schedules} />}
    </div>
  );
}
