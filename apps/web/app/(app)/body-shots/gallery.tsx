"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useFireToast } from "@/components/ui/toast";
import { Card, Overline } from "@/components/kit";

interface Session {
  id: string;
  captured_at: string;
  front_url: string | null;
  back_url: string | null;
  left_url: string | null;
  right_url: string | null;
  weight_at_capture_lb: number | null;
  notes: string | null;
}

const ANGLE_LABELS: { key: keyof Session; label: string }[] = [
  { key: "front_url", label: "Front" },
  { key: "back_url", label: "Back" },
  { key: "left_url", label: "Left" },
  { key: "right_url", label: "Right" },
];

export function Gallery({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const toast = useFireToast();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function deleteSession(id: string) {
    if (!confirm("Delete this session and its photos? Cannot be undone.")) return;
    setDeleting(id);
    const res = await fetch(`/api/body-shots/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Could not delete");
      return;
    }
    toast.success("Session deleted");
    router.refresh();
  }

  return (
    <>
      <ul className="flex flex-col gap-[var(--space-grid)]">
        {sessions.map((s) => (
          <li key={s.id}>
            <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--fg)]">
                    {new Date(s.captured_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    {s.weight_at_capture_lb !== null && (
                      <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--fg-muted)]">
                        {Number(s.weight_at_capture_lb).toFixed(1)}
                        <span className="text-[var(--fg-subtle)]"> lb</span>
                      </span>
                    )}
                    {s.notes && (
                      <span className="font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
                        {s.notes}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSession(s.id)}
                  disabled={deleting === s.id}
                  className="text-[var(--fg-subtle)] transition-colors hover:text-[var(--danger)]"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ANGLE_LABELS.map(({ key, label }) => {
                  const url = s[key] as string | null;
                  return (
                    <div
                      key={key}
                      className="overflow-hidden rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)]"
                    >
                      <div className="relative aspect-[3/4] w-full">
                        {url ? (
                          <button
                            type="button"
                            onClick={() => setLightbox(url)}
                            className="absolute inset-0 h-full w-full"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={label} className="h-full w-full object-cover" />
                          </button>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Overline style={{ fontSize: "var(--text-2xs)" }}>no {label.toLowerCase()}</Overline>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-[var(--border)] px-2 py-1.5">
                        <Overline style={{ fontSize: "var(--text-2xs)" }}>{label}</Overline>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {lightbox && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="enlarged"
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
          />
        </button>
      )}
    </>
  );
}

