"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { Card, Overline } from "@/components/kit";

type Angle = "front" | "back" | "left" | "right";
const ANGLES: { id: Angle; label: string; tip: string }[] = [
  { id: "front", label: "Front", tip: "Face the camera, arms slightly out, neutral posture." },
  { id: "back", label: "Back", tip: "Turn around. Same posture." },
  { id: "left", label: "Left side", tip: "Turn 90° clockwise so your left side faces the camera." },
  { id: "right", label: "Right side", tip: "Turn 180°. Right side to camera." },
];

interface UploadedPhoto {
  url: string;
  pathname: string;
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback (old browsers)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function CaptureFlow() {
  const router = useRouter();
  const toast = useFireToast();
  const [sessionId] = useState(() => newSessionId());
  const [photos, setPhotos] = useState<Partial<Record<Angle, UploadedPhoto>>>({});
  const [uploadingAngle, setUploadingAngle] = useState<Angle | null>(null);
  const [weight, setWeight] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function uploadFile(angle: Angle, file: File) {
    setUploadingAngle(angle);
    const form = new FormData();
    form.set("file", file);
    form.set("angle", angle);
    form.set("session_id", sessionId);
    const res = await fetch("/api/body-shots/upload", { method: "POST", body: form });
    setUploadingAngle(null);
    if (res.status === 401) {
      router.replace("/signin?next=/body-shots/capture");
      return;
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Upload failed");
      return;
    }
    const body = (await res.json()) as { data: UploadedPhoto };
    setPhotos((prev) => ({ ...prev, [angle]: body.data }));
    toast.success(`${angle} uploaded`);
  }

  async function save() {
    const anyPhoto = Object.values(photos).some(Boolean);
    if (!anyPhoto) {
      toast.error("Upload at least one angle first.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/body-shots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        front_url: photos.front?.url ?? null,
        back_url: photos.back?.url ?? null,
        left_url: photos.left?.url ?? null,
        right_url: photos.right?.url ?? null,
        weight_at_capture_lb: weight ? Number(weight) : null,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (res.status === 401) {
      router.replace("/signin?next=/body-shots/capture");
      return;
    }
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Could not save session");
      return;
    }
    toast.success("Session saved");
    router.replace("/body-shots");
    router.refresh();
  }

  const completed = Object.values(photos).filter(Boolean).length;

  return (
    <div className="space-y-[var(--space-grid)]">
      <Card pad={18}>
        <div className="flex items-baseline justify-between">
          <Overline>Progress</Overline>
          <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-[var(--fg)]">
            {completed}
            <span className="text-[var(--fg-subtle)]">/4 angles</span>
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[var(--r-pill)] bg-[var(--surface-2)]">
          <div
            className="h-full transition-all"
            style={{ width: `${(completed / 4) * 100}%`, background: "var(--primary)" }}
          />
        </div>
      </Card>

      <ul className="space-y-[var(--space-grid)]">
        {ANGLES.map((a) => {
          const uploaded = photos[a.id];
          return (
            <li key={a.id}>
              <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--fg)]">
                      {a.label}
                    </h3>
                    {uploaded && (
                      <CheckCircle2 className="h-4 w-4" style={{ color: "var(--positive)" }} />
                    )}
                  </div>
                  <p className="mt-0.5 font-[family-name:var(--font-sans)] text-xs text-[var(--fg-muted)]">
                    {a.tip}
                  </p>
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(a.id, f);
                      e.target.value = "";
                    }}
                  />
                  <span
                    className={`inline-flex items-center gap-2 rounded-[var(--r-md)] border px-3 py-1.5 font-[family-name:var(--font-sans)] text-xs font-medium transition-colors hover:bg-[var(--surface-2)] ${
                      uploaded
                        ? "border-[var(--border)] text-[var(--fg-muted)]"
                        : "border-[var(--primary-line)] text-[var(--primary-bright)]"
                    }`}
                  >
                    {uploadingAngle === a.id ? (
                      "Uploading…"
                    ) : uploaded ? (
                      <>
                        <Upload className="h-3 w-3" /> Replace
                      </>
                    ) : (
                      <>
                        <Camera className="h-3 w-3" /> Add photo
                      </>
                    )}
                  </span>
                </label>
              </div>
              {uploaded && (
                <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploaded.url}
                    alt={a.label}
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              )}
              </Card>
            </li>
          );
        })}
      </ul>

      <Card title="Optional" pad={18} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="weight">Weight at capture (lb)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="lighting, time of day, anything to note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <a href="/body-shots">Cancel</a>
        </Button>
        <Button onClick={save} disabled={saving || completed === 0} className="flex-1">
          {saving ? "Saving…" : `Save session (${completed}/4)`}
        </Button>
      </div>
    </div>
  );
}
