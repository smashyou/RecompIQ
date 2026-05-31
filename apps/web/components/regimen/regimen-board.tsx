"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Square, ChevronRight, FlaskRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { Card, Overline } from "@/components/kit";
import { PeptideDrawer, type ExistingItem } from "./peptide-drawer";

export interface BoardItem {
  id: string;
  compound_id: string;
  compound_slug: string;
  compound_name: string;
  evidence_level: string;
  fda_approved: boolean;
  dose_value: number | null;
  dose_unit: string | null;
  route: string | null;
  frequency: string | null;
  starts_on: string | null;
  notes: string | null;
}

export interface BoardPhase {
  id: string;
  ordinal: number;
  name: string;
  legacy_phase: string | null;
  starts_on: string | null;
  ends_on: string | null;
  items: BoardItem[];
}

interface Props {
  phases: BoardPhase[];
  conditions: string[];
  medications: string[];
}

export function RegimenBoard({ phases, conditions, medications }: Props) {
  const router = useRouter();
  const toast = useFireToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editItem, setEditItem] = useState<ExistingItem | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditItem(null);
    setDrawerOpen(true);
  }
  function openEdit(item: BoardItem) {
    setEditItem({
      id: item.id,
      compound_id: item.compound_id,
      compound_name: item.compound_name,
      compound_slug: item.compound_slug,
      evidence_level: item.evidence_level,
      fda_approved: item.fda_approved,
      dose_value: item.dose_value,
      dose_unit: item.dose_unit,
      route: item.route,
      frequency: item.frequency,
      starts_on: item.starts_on,
      notes: item.notes,
    });
    setDrawerOpen(true);
  }

  async function stopItem(item: BoardItem) {
    if (!confirm(`Stop ${item.compound_name}? It will be marked ended today.`)) return;
    const res = await fetch(`/api/regimen/items/${item.id}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      toast.error("Could not stop item");
      return;
    }
    toast.success(`${item.compound_name} stopped`);
    router.refresh();
  }

  async function advancePhase() {
    if (!phaseName.trim()) {
      toast.error("Name the new phase.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/regimen/phases/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: phaseName.trim(), close_current: true }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not advance phase");
      return;
    }
    toast.success(`Advanced to “${phaseName.trim()}”`);
    setAdvancing(false);
    setPhaseName("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openAdd} className="gap-2">
          <Plus size={16} /> Add to regimen
        </Button>
        <Button variant="outline" onClick={() => setAdvancing((v) => !v)} className="gap-2">
          <ChevronRight size={16} /> Advance phase
        </Button>
      </div>

      {advancing && (
        <Card>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase">New phase name</Label>
            <div className="flex gap-2">
              <Input
                value={phaseName}
                placeholder="e.g. Phase 2 — muscle gain"
                onChange={(e) => setPhaseName(e.target.value)}
              />
              <Button onClick={advancePhase} disabled={busy}>
                {busy ? "…" : "Start"}
              </Button>
            </div>
            <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
              Closes the current phase (ends today) and opens a new one. Items don&apos;t carry over
              automatically — add them to the new phase.
            </p>
          </div>
        </Card>
      )}

      {phases.length === 0 ? (
        <Card style={{ borderStyle: "dashed" }}>
          <div className="py-6 text-center">
            <FlaskRound className="mx-auto mb-3 h-8 w-8 text-[var(--fg-subtle)]" />
            <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-muted)]">
              Your regimen is empty. Add the compounds you and your clinician have decided on.
            </p>
          </div>
        </Card>
      ) : (
        phases.map((phase) => {
          const isCurrent = phase.ends_on === null;
          return (
            <Card key={phase.id} pad={0}>
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] px-[18px] py-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Overline style={{ fontSize: 9 }}>Phase {phase.ordinal}</Overline>
                  <h2 className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-[-0.01em] text-[var(--fg)]">
                    {phase.name}
                  </h2>
                  {phase.legacy_phase && (
                    <span className="rounded-[var(--r-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">
                      {phase.legacy_phase}
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-[var(--r-pill)] border border-[var(--primary-line)] bg-[var(--primary-wash)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--primary-bright)]">
                      current
                    </span>
                  )}
                </div>
                <span className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                  {phase.starts_on
                    ? `started ${new Date(phase.starts_on).toLocaleDateString()}`
                    : "not started"}
                </span>
              </div>
              {phase.items.length === 0 ? (
                <p className="px-[18px] py-4 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-subtle)]">
                  No compounds in this phase.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {phase.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-[18px] py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/peptides/library/${item.compound_slug}`}
                            className="font-[family-name:var(--font-sans)] text-[13.5px] font-medium text-[var(--fg)] hover:text-[var(--primary)]"
                          >
                            {item.compound_name}
                          </Link>
                          <EvidenceBadge
                            level={item.evidence_level as never}
                            fdaApproved={item.fda_approved}
                          />
                        </div>
                        <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
                          {[item.frequency, item.route, item.notes].filter(Boolean).join(" · ") ||
                            "schedule not set"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          {item.dose_value !== null ? (
                            <>
                              <p className="font-[family-name:var(--font-mono)] text-[14px] font-medium tabular-nums text-[var(--fg)]">
                                {item.dose_value}
                                <span className="ml-1 text-[11px] text-[var(--fg-subtle)]">
                                  {item.dose_unit}
                                </span>
                              </p>
                              <Overline style={{ fontSize: 9, letterSpacing: "0.07em" }}>
                                user-supplied
                              </Overline>
                            </>
                          ) : (
                            <p className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
                              dose not set
                            </p>
                          )}
                        </div>
                        {isCurrent && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              aria-label="Edit"
                              className="grid h-7 w-7 place-items-center rounded-[var(--r-sm)] border border-[var(--border)] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => stopItem(item)}
                              aria-label="Stop"
                              className="grid h-7 w-7 place-items-center rounded-[var(--r-sm)] border border-[var(--border)] text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger,var(--fg))]"
                            >
                              <Square size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}

      <PeptideDrawer
        open={drawerOpen}
        mode={editItem ? "edit" : "add"}
        item={editItem}
        conditions={conditions}
        medications={medications}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => setDrawerOpen(false)}
      />
    </div>
  );
}
