"use client";

import { useState } from "react";
import { AlertTriangle, Check, Clock, Loader2 } from "lucide-react";
import type { EvidenceLevel } from "@peptide/shared";
// Type-only import from the server-only loader: erased at compile, so no
// server module is pulled into this client bundle.
import { type AlertRow } from "@/lib/queries/alerts";
import { EvidenceBadge } from "@/components/peptides/evidence-badge";
import { Card, Overline } from "@/components/kit";

type Severity = "critical" | "warn" | "info";

const SEV_ORDER: Severity[] = ["critical", "warn", "info"];

const SEV_META: Record<
  Severity,
  { label: string; border: string; wash: string; fg: string }
> = {
  critical: {
    label: "Critical",
    border: "var(--danger-line)",
    wash: "var(--danger-wash)",
    fg: "var(--danger-bright)",
  },
  warn: {
    label: "Warning",
    border: "var(--warn-line)",
    wash: "var(--warn-wash)",
    fg: "var(--warn-foreground)",
  },
  info: {
    label: "Info",
    border: "var(--border)",
    wash: "var(--surface-1)",
    fg: "var(--fg-muted)",
  },
};

export function AlertsClient({
  initialActive,
  initialHistory,
}: {
  initialActive: AlertRow[];
  initialHistory: AlertRow[];
}) {
  const [active, setActive] = useState<AlertRow[]>(initialActive);

  async function dismiss(id: string, action: "ack" | "snooze") {
    const prev = active;
    setActive((cur) => cur.filter((a) => a.id !== id)); // optimistic
    const res = await fetch(`/api/alerts/${id}/${action}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: action === "snooze" ? JSON.stringify({ days: 7 }) : undefined,
    });
    if (!res.ok) setActive(prev); // rollback to truth
  }

  if (active.length === 0) {
    return (
      <div className="space-y-5">
        <Card>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Check size={22} className="text-[var(--positive)]" />
            <p className="font-[family-name:var(--font-sans)] text-sm font-medium text-[var(--fg)]">
              No active alerts
            </p>
            <p className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-subtle)]">
              Nothing in your recent logs crossed a threshold.
            </p>
          </div>
        </Card>
        <HistorySection history={initialHistory} />
      </div>
    );
  }

  const grouped = SEV_ORDER.map((sev) => ({
    sev,
    rows: active.filter((a) => a.severity === sev),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map(({ sev, rows }) => (
        <div key={sev} className="space-y-2">
          <Overline>
            {SEV_META[sev].label} · {rows.length}
          </Overline>
          <div className="space-y-2.5">
            {rows.map((a) => (
              <AlertCard key={a.id} alert={a} onDismiss={dismiss} />
            ))}
          </div>
        </div>
      ))}
      <HistorySection history={initialHistory} />
    </div>
  );
}

function AlertCard({
  alert,
  onDismiss,
}: {
  alert: AlertRow;
  onDismiss: (id: string, action: "ack" | "snooze") => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<"ack" | "snooze" | null>(null);
  const meta = SEV_META[alert.severity as Severity] ?? SEV_META.info;

  async function act(action: "ack" | "snooze") {
    setBusy(action);
    try {
      await onDismiss(alert.id, action);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card pad={14} style={{ borderColor: meta.border, background: meta.wash }}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={17} className="mt-0.5 shrink-0" style={{ color: meta.fg }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-[family-name:var(--font-sans)] text-sm font-semibold"
              style={{ color: "var(--fg)" }}
            >
              {alert.title}
            </span>
            <EvidenceBadge level={alert.evidence_level as EvidenceLevel} />
          </div>
          <p className="mt-1 font-[family-name:var(--font-sans)] text-sm leading-[1.5] text-[var(--fg-muted)]">
            {alert.message}
          </p>
          <p className="mt-1.5 font-[family-name:var(--font-sans)] text-2xs text-[var(--fg-subtle)]">
            {alert.citation}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => act("ack")}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 font-[family-name:var(--font-sans)] text-xs font-medium text-[var(--fg)] disabled:opacity-50"
            >
              {busy === "ack" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Acknowledge
            </button>
            <button
              onClick={() => act("snooze")}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 font-[family-name:var(--font-sans)] text-xs font-medium text-[var(--fg-muted)] disabled:opacity-50"
            >
              {busy === "snooze" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Clock size={13} />
              )}
              Snooze 7d
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HistorySection({ history }: { history: AlertRow[] }) {
  if (history.length === 0) return null;
  return (
    <details className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
      <summary className="cursor-pointer font-[family-name:var(--font-sans)] text-xs font-medium text-[var(--fg-muted)]">
        Resolved &amp; snoozed · {history.length}
      </summary>
      <ul className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
        {history.map((a) => (
          <li
            key={a.id}
            className="flex items-start justify-between gap-2 font-[family-name:var(--font-sans)] text-xs"
          >
            <div className="min-w-0">
              <span className="font-medium text-[var(--fg)]">{a.title}</span>
              <p className="mt-0.5 text-2xs leading-snug text-[var(--fg-subtle)]">{a.message}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-2xs uppercase tracking-wide text-[var(--fg-subtle)]">
              {a.status === "resolved" ? "resolved" : "snoozed"}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
