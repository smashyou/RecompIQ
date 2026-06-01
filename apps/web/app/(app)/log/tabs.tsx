"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Activity, Droplets, Footprints, HeartPulse, Moon, Scale, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { WeightForm } from "./forms/weight";
import { VitalForm } from "./forms/vital";
import { SymptomForm } from "./forms/symptom";
import { SleepForm } from "./forms/sleep";
import { WaterForm } from "./forms/water";
import { StepsForm } from "./forms/steps";
import { GoalMetricsForm } from "./forms/goals";

const TABS = [
  { id: "weight", label: "Weight", icon: Scale, Form: WeightForm },
  { id: "vital", label: "Vitals", icon: HeartPulse, Form: VitalForm },
  { id: "symptom", label: "Symptoms", icon: Activity, Form: SymptomForm },
  { id: "goals", label: "Goals", icon: Target, Form: GoalMetricsForm },
  { id: "sleep", label: "Sleep", icon: Moon, Form: SleepForm },
  { id: "water", label: "Water", icon: Droplets, Form: WaterForm },
  { id: "steps", label: "Steps", icon: Footprints, Form: StepsForm },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function LogTabs({
  showNeuro = false,
  showNausea = false,
}: {
  showNeuro?: boolean;
  showNausea?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const active = (TABS.find((t) => t.id === raw)?.id ?? "weight") as TabId;
  const ActiveForm = TABS.find((t) => t.id === active)!.Form;

  function setTab(id: TabId) {
    const sp = new URLSearchParams(params);
    sp.set("tab", id);
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto rounded-[var(--r-md)] border border-border p-1"
        style={{ background: "var(--surface-1)" }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-[var(--r-sm)] px-3 py-2 font-[family-name:var(--font-sans)] text-xs font-medium transition-colors",
                selected
                  ? "bg-[var(--primary-wash)] text-[var(--primary-bright)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>
      {active === "goals" ? (
        <GoalMetricsForm showNeuro={showNeuro} showNausea={showNausea} />
      ) : (
        <ActiveForm />
      )}
    </div>
  );
}
