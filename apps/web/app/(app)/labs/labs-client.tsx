"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Plus, Trash2, Loader2, X } from "lucide-react";
import {
  LAB_MARKER_DEFS,
  matchMarkerKey,
  effectiveRange,
  rangeStatus,
  LAB_MARKER_BY_KEY,
  type RangeStatus,
} from "@peptide/shared";
import { postJson } from "@/lib/post-json";
import { Card, Overline } from "@/components/kit";
import {
  shapeLabSeries,
  formatLabValue,
  type LabReadingRow,
  type MarkerSeries,
} from "@/lib/labs-shape";

const today = () => new Date().toISOString().slice(0, 10);

// A parsed/editable row in the OCR review table.
interface ReviewRow {
  marker_key: string | null;
  marker: string;
  value: string; // string while editing
  unit: string;
  ref_low: string;
  ref_high: string;
  skip: boolean;
}

interface ParsedResult {
  marker_key: string | null;
  marker: string;
  raw_name: string;
  panel: string | null;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  status: RangeStatus;
}

type Mode = "idle" | "uploading" | "parsing" | "review";

export function LabsClient({ initialRows }: { initialRows: LabReadingRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<LabReadingRow[]>(initialRows);
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // OCR review state
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [reviewDate, setReviewDate] = useState(today());
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState<string | null>(null);
  const [reviewRaw, setReviewRaw] = useState<unknown>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const series = useMemo(() => shapeLabSeries(rows), [rows]);

  async function refresh() {
    const r = await fetch("/api/labs", { credentials: "same-origin" });
    const j = await r.json().catch(() => null);
    if (j?.data?.results) setRows(j.data.results as LabReadingRow[]);
  }

  async function onFile(file: File) {
    setError(null);
    setMode("uploading");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const upRes = await fetch("/api/labs/upload", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const upJson = await upRes.json();
      if (!upRes.ok || upJson.error) {
        throw new Error(upJson.error?.message ?? "Upload failed");
      }
      const { blob_url, kind } = upJson.data as { blob_url: string; kind: "image" | "pdf" };

      setMode("parsing");
      const parseRes = await postJson<{
        collected_on: string | null;
        results: ParsedResult[];
        ocr_raw: unknown;
      }>("/api/labs/parse", { blob_url, kind }, router);

      if (!parseRes.ok) throw new Error(parseRes.message);
      const data = parseRes.data;
      if (!data.results.length) {
        throw new Error(
          "No numeric lab results were found. Try a clearer photo, or add markers by hand below.",
        );
      }
      setReviewRows(
        data.results.map((r) => ({
          marker_key: r.marker_key,
          marker: r.marker,
          value: String(r.value),
          unit: r.unit ?? "",
          ref_low: r.ref_low != null ? String(r.ref_low) : "",
          ref_high: r.ref_high != null ? String(r.ref_high) : "",
          skip: false,
        })),
      );
      setReviewDate(data.collected_on ?? today());
      setReviewPhotoUrl(blob_url);
      setReviewRaw(data.ocr_raw);
      setMode("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMode("idle");
    } finally {
      setBusy(false);
    }
  }

  async function saveReview() {
    setBusy(true);
    setError(null);
    try {
      const payloadResults = reviewRows
        .filter((r) => !r.skip && r.marker.trim() && r.value.trim() !== "" && !Number.isNaN(Number(r.value)))
        .map((r) => {
          const key = r.marker_key ?? matchMarkerKey(r.marker);
          const def = key ? LAB_MARKER_BY_KEY[key] : undefined;
          return {
            panel: def?.panel ?? null,
            marker: r.marker.trim(),
            marker_key: key,
            value: Number(r.value),
            unit: r.unit.trim() || null,
            ref_low: r.ref_low.trim() !== "" ? Number(r.ref_low) : null,
            ref_high: r.ref_high.trim() !== "" ? Number(r.ref_high) : null,
            collected_on: reviewDate,
            source: "ocr" as const,
            photo_url: reviewPhotoUrl,
          };
        });
      if (!payloadResults.length) {
        throw new Error("Nothing to save — every row is skipped or empty.");
      }
      const res = await postJson("/api/labs", { results: payloadResults, ocr_raw: reviewRaw }, router);
      if (!res.ok) throw new Error(res.message);
      setMode("idle");
      setReviewRows([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReading(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id)); // optimistic
    const res = await fetch(`/api/labs/${id}`, { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) await refresh(); // rollback to truth
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--danger-line)] bg-[var(--danger-wash)] px-3 py-2 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--danger-bright)]">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {mode === "review" ? (
        <ReviewPanel
          rows={reviewRows}
          setRows={setReviewRows}
          date={reviewDate}
          setDate={setReviewDate}
          busy={busy}
          onSave={saveReview}
          onCancel={() => {
            setMode("idle");
            setReviewRows([]);
          }}
        />
      ) : (
        <UploadCard
          mode={mode}
          fileRef={fileRef}
          onPick={() => fileRef.current?.click()}
          onFile={onFile}
        />
      )}

      <ManualEntry busy={busy} router={router} onSaved={refresh} setError={setError} />

      <MarkerHistory series={series} onDelete={deleteReading} />
    </div>
  );
}

// ── Upload card ────────────────────────────────────────────────────────────
function UploadCard({
  mode,
  fileRef,
  onPick,
  onFile,
}: {
  mode: Mode;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onFile: (f: File) => void;
}) {
  const working = mode === "uploading" || mode === "parsing";
  return (
    <Card title="Read a lab report" hint="photo or PDF">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={onPick}
        disabled={working}
        className="flex w-full flex-col items-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--border)] bg-[var(--surface-1)] px-4 py-7 text-center transition-colors hover:border-[var(--primary-line)] disabled:opacity-60"
      >
        {working ? (
          <Loader2 size={22} className="animate-spin text-[var(--primary-bright)]" />
        ) : (
          <span className="flex gap-2 text-[var(--fg-muted)]">
            <Upload size={20} />
            <FileText size={20} />
          </span>
        )}
        <span className="font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]">
          {mode === "uploading"
            ? "Uploading…"
            : mode === "parsing"
              ? "Reading your report…"
              : "Upload a lab report (JPEG/PNG/PDF)"}
        </span>
        <span className="font-[family-name:var(--font-sans)] text-[11px] text-[var(--fg-subtle)]">
          We transcribe the printed values for you to review before saving. Nothing is interpreted.
        </span>
      </button>
    </Card>
  );
}

// ── OCR review panel ───────────────────────────────────────────────────────
function ReviewPanel({
  rows,
  setRows,
  date,
  setDate,
  busy,
  onSave,
  onCancel,
}: {
  rows: ReviewRow[];
  setRows: React.Dispatch<React.SetStateAction<ReviewRow[]>>;
  date: string;
  setDate: (d: string) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  function update(i: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  const kept = rows.filter((r) => !r.skip).length;

  return (
    <Card title="Review & confirm" hint={`${kept} of ${rows.length} markers`}>
      <p className="mb-3 font-[family-name:var(--font-sans)] text-[11.5px] text-[var(--fg-subtle)]">
        Check each value against your report. Edit anything the reader got wrong, untick rows you
        don&apos;t want, then save. These are your own values — RecompIQ only flags what falls
        outside a typical range.
      </p>

      <label className="mb-3 flex items-center gap-2 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-muted)]">
        Collected on
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 font-[family-name:var(--font-mono)] text-[12px] text-[var(--fg)]"
        />
      </label>

      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const lo = r.ref_low.trim() !== "" ? Number(r.ref_low) : null;
          const hi = r.ref_high.trim() !== "" ? Number(r.ref_high) : null;
          const val = r.value.trim() !== "" && !Number.isNaN(Number(r.value)) ? Number(r.value) : null;
          const status = val != null ? rangeStatus(val, lo, hi) : "unknown";
          return (
            <div
              key={i}
              className={`grid grid-cols-[auto_1fr] items-center gap-2 rounded-[var(--r-sm)] border border-[var(--border)] px-2 py-1.5 ${
                r.skip ? "opacity-45" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={!r.skip}
                onChange={(e) => update(i, { skip: !e.target.checked })}
                aria-label={`Include ${r.marker}`}
              />
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[1.6fr_0.8fr_0.7fr_1fr_auto]">
                <input
                  value={r.marker}
                  onChange={(e) => update(i, { marker: e.target.value })}
                  placeholder="Marker"
                  className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg)]"
                />
                <input
                  value={r.value}
                  inputMode="decimal"
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder="Value"
                  className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-[var(--fg)]"
                />
                <input
                  value={r.unit}
                  onChange={(e) => update(i, { unit: e.target.value })}
                  placeholder="Unit"
                  className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--fg-muted)]"
                />
                <span className="flex items-center gap-1">
                  <input
                    value={r.ref_low}
                    inputMode="decimal"
                    onChange={(e) => update(i, { ref_low: e.target.value })}
                    placeholder="low"
                    className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-1.5 py-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--fg-muted)]"
                  />
                  <span className="text-[var(--fg-subtle)]">–</span>
                  <input
                    value={r.ref_high}
                    inputMode="decimal"
                    onChange={(e) => update(i, { ref_high: e.target.value })}
                    placeholder="high"
                    className="w-full rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-1.5 py-1 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--fg-muted)]"
                  />
                </span>
                <StatusBadge status={status} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onSave}
          disabled={busy || kept === 0}
          className="rounded-[var(--r-md)] bg-[var(--primary)] px-4 py-2 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {busy ? "Saving…" : `Save ${kept} marker${kept === 1 ? "" : "s"}`}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2 font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg-muted)]"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ── Manual single-marker entry ─────────────────────────────────────────────
function ManualEntry({
  busy,
  router,
  onSaved,
  setError,
}: {
  busy: boolean;
  router: ReturnType<typeof useRouter>;
  onSaved: () => Promise<void>;
  setError: (s: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [markerKey, setMarkerKey] = useState("");
  const [customName, setCustomName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  function pickMarker(key: string) {
    setMarkerKey(key);
    const def = LAB_MARKER_BY_KEY[key];
    if (def) setUnit(def.unit);
  }

  async function submit() {
    setError(null);
    const def = markerKey ? LAB_MARKER_BY_KEY[markerKey] : undefined;
    const marker = def?.label ?? customName.trim();
    if (!marker) return setError("Pick a marker or type a name.");
    if (value.trim() === "" || Number.isNaN(Number(value))) return setError("Enter a numeric value.");
    const key = markerKey || matchMarkerKey(marker);
    const range = effectiveRange(key, null, null);
    setSaving(true);
    try {
      const res = await postJson(
        "/api/labs",
        {
          results: [
            {
              panel: def?.panel ?? null,
              marker,
              marker_key: key,
              value: Number(value),
              unit: unit.trim() || def?.unit || null,
              ref_low: range.low,
              ref_high: range.high,
              collected_on: date,
              source: "manual",
            },
          ],
        },
        router,
      );
      if (!res.ok) throw new Error(res.message);
      setValue("");
      setCustomName("");
      setMarkerKey("");
      setUnit("");
      setOpen(false);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 font-[family-name:var(--font-sans)] text-[12.5px] font-medium text-[var(--fg-muted)] hover:border-[var(--primary-line)] hover:text-[var(--fg)]"
      >
        <Plus size={15} /> Add a marker by hand
      </button>
    );
  }

  return (
    <Card title="Add a marker" hint="manual entry">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <Overline>Marker</Overline>
          <select
            value={markerKey}
            onChange={(e) => pickMarker(e.target.value)}
            className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg)]"
          >
            <option value="">Other / type below…</option>
            {LAB_MARKER_DEFS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} ({m.unit})
              </option>
            ))}
          </select>
        </label>
        {!markerKey && (
          <label className="flex flex-col gap-1">
            <Overline>Custom name</Overline>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Magnesium"
              className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg)]"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <Overline>Value</Overline>
          <input
            value={value}
            inputMode="decimal"
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-[12.5px] tabular-nums text-[var(--fg)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <Overline>Unit</Overline>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="mg/dL"
            className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-[12px] text-[var(--fg-muted)]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <Overline>Collected on</Overline>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-[12px] text-[var(--fg)]"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={saving || busy}
          className="rounded-[var(--r-md)] bg-[var(--primary)] px-4 py-2 font-[family-name:var(--font-sans)] text-[13px] font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save marker"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-[var(--r-md)] border border-[var(--border)] px-4 py-2 font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg-muted)]"
        >
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ── Marker history ─────────────────────────────────────────────────────────
function MarkerHistory({
  series,
  onDelete,
}: {
  series: MarkerSeries[];
  onDelete: (id: string) => void;
}) {
  if (series.length === 0) {
    return (
      <Card>
        <p className="py-2 text-center font-[family-name:var(--font-sans)] text-[12.5px] text-[var(--fg-subtle)]">
          No labs yet. Upload a report or add a marker to start tracking trends.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <Overline>Your markers · {series.length}</Overline>
      <div className="grid gap-2 sm:grid-cols-2">
        {series.map((s) => (
          <MarkerCard key={s.key} s={s} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function MarkerCard({ s, onDelete }: { s: MarkerSeries; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const latestVal = formatLabValue(s.latest.value, s.decimals);
  const rangeText =
    s.effLow != null || s.effHigh != null
      ? `${s.effLow ?? "–"}–${s.effHigh ?? "–"}${s.unit ? ` ${s.unit}` : ""}`
      : "no reference range";
  return (
    <Card pad={14}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-[family-name:var(--font-sans)] text-[13.5px] font-semibold text-[var(--fg)]">
            {s.marker}
          </div>
          {s.panelLabel && (
            <div className="font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]">
              {s.panelLabel}
            </div>
          )}
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <span className="font-[family-name:var(--font-mono)] text-[22px] font-semibold tabular-nums text-[var(--fg)]">
            {latestVal}
          </span>
          {s.unit && (
            <span className="ml-1 font-[family-name:var(--font-mono)] text-[12px] text-[var(--fg-subtle)]">
              {s.unit}
            </span>
          )}
        </div>
        <Sparkline series={s} />
      </div>

      <div className="mt-1.5 flex items-center justify-between font-[family-name:var(--font-sans)] text-[10.5px] text-[var(--fg-subtle)]">
        <span>
          ref {rangeText}
          {s.refSource === "catalog" && <span className="ml-1 opacity-70">(typical)</span>}
        </span>
        <span>{s.latest.collected_on}</span>
      </div>
      {s.refSource === "catalog" && s.sexSpecific && (
        <p className="mt-0.5 font-[family-name:var(--font-sans)] text-[10px] leading-snug text-[var(--warn-foreground)]">
          Sex-specific range — discuss with your clinician.
        </p>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 font-[family-name:var(--font-sans)] text-[11px] font-medium text-[var(--primary-bright)]"
      >
        {expanded ? "Hide" : `History (${s.readings.length})`}
      </button>
      {expanded && (
        <ul className="mt-1.5 space-y-1 border-t border-[var(--border)] pt-2">
          {[...s.readings].reverse().map((r) => {
            const st = rangeStatus(r.value, r.ref_low ?? s.effLow, r.ref_high ?? s.effHigh);
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 font-[family-name:var(--font-sans)] text-[11.5px]"
              >
                <span className="text-[var(--fg-subtle)]">{r.collected_on}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`font-[family-name:var(--font-mono)] tabular-nums ${
                      st === "in" || st === "unknown" ? "text-[var(--fg)]" : "text-[var(--warn-foreground)]"
                    }`}
                  >
                    {formatLabValue(r.value, s.decimals)}
                  </span>
                  {r.source === "manual" && (
                    <span className="text-[9px] uppercase tracking-wide text-[var(--fg-subtle)]">man</span>
                  )}
                  <button
                    onClick={() => onDelete(r.id)}
                    aria-label="Delete reading"
                    className="text-[var(--fg-subtle)] hover:text-[var(--danger-bright)]"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Sparkline({ series }: { series: MarkerSeries }) {
  const pts = series.readings;
  if (pts.length < 2) return <span className="text-[10px] text-[var(--fg-subtle)]">1 reading</span>;
  const w = 96;
  const h = 30;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = w / (pts.length - 1);
  const coords = pts.map((p, i) => {
    const x = i * stepX;
    const y = h - 4 - ((p.value - min) / span) * (h - 8);
    return [x, y] as const;
  });
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1] ?? [0, 0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke="var(--primary-bright)" strokeWidth={1.5} />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill="var(--primary-bright)" />
    </svg>
  );
}

function StatusBadge({ status }: { status: RangeStatus }) {
  if (status === "unknown") {
    return (
      <span className="rounded-[var(--r-pill)] border border-[var(--border)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-wide text-[var(--fg-subtle)]">
        no range
      </span>
    );
  }
  if (status === "in") {
    return (
      <span className="rounded-[var(--r-pill)] border border-[var(--positive-line)] bg-[var(--positive-wash)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-wide text-[var(--positive)]">
        in range
      </span>
    );
  }
  return (
    <span className="rounded-[var(--r-pill)] border border-[var(--warn-line)] bg-[var(--warn-wash)] px-2 py-0.5 font-[family-name:var(--font-sans)] text-[9.5px] font-semibold uppercase tracking-wide text-[var(--warn-foreground)]">
      {status === "high" ? "high" : "low"}
    </span>
  );
}
