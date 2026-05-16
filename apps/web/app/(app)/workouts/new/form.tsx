"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";

interface TemplateExercise {
  name: string;
  sets?: number;
  reps?: number;
  duration_min?: number;
  notes?: string;
}

interface Template {
  slug: string;
  name: string;
  phase: string;
  session_type: string;
  exercises: TemplateExercise[];
}

interface DraftExercise {
  name: string;
  sets: number | null;
  reps: number | null;
  load_lb: number | null;
  duration_min: number | null;
  notes: string;
}

const SESSION_TYPES = ["lifting", "mobility", "cardio", "walking", "mixed"] as const;
const PHASES = ["P1", "P2", "P3", "plateau", "maintenance"] as const;

export function NewWorkoutForm({
  template,
  userPhase,
}: {
  template: Template | null;
  userPhase: string;
}) {
  const router = useRouter();
  const toast = useFireToast();
  const [sessionType, setSessionType] = useState<string>(
    template?.session_type ?? "mixed",
  );
  const [phase, setPhase] = useState<string>(template?.phase ?? userPhase);
  const [name, setName] = useState<string>(template?.name ?? "");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState<number>(30);
  const [rpe, setRpe] = useState<number>(5);
  const [notes, setNotes] = useState<string>("");
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    (template?.exercises ?? []).map((e) => ({
      name: e.name,
      sets: e.sets ?? null,
      reps: e.reps ?? null,
      load_lb: null,
      duration_min: e.duration_min ?? null,
      notes: e.notes ?? "",
    })),
  );
  const [submitting, setSubmitting] = useState(false);

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      { name: "", sets: null, reps: null, load_lb: null, duration_min: null, notes: "" },
    ]);
  }
  function updateExercise(idx: number, patch: Partial<DraftExercise>) {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function removeExercise(idx: number) {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim() && !template) {
      toast.error("Give the session a name.");
      return;
    }
    const namedExercises = exercises.filter((e) => e.name.trim());
    if (namedExercises.length === 0) {
      toast.error("Add at least one exercise (with a name).");
      return;
    }
    setSubmitting(true);
    const wRes = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: sessionType,
        phase,
        date,
        duration_min: duration || null,
        perceived_exertion: rpe || null,
        template_slug: template?.slug ?? null,
        name: name || null,
        notes: notes || null,
      }),
    });
    if (wRes.status === 401) {
      setSubmitting(false);
      router.replace("/signin?next=/workouts/new");
      return;
    }
    if (!wRes.ok) {
      setSubmitting(false);
      const body = (await wRes.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Could not save session");
      return;
    }
    const wBody = (await wRes.json()) as { data: { id: string } };
    const workoutId = wBody.data.id;

    const exRes = await fetch(`/api/workouts/${workoutId}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: namedExercises.map((e, idx) => ({
          order_index: idx,
          name: e.name.trim(),
          sets: e.sets ?? null,
          reps: e.reps ?? null,
          load_lb: e.load_lb ?? null,
          duration_min: e.duration_min ?? null,
          notes: e.notes || null,
        })),
      }),
    });
    setSubmitting(false);
    if (!exRes.ok) {
      const body = (await exRes.json()) as { error?: { message: string } };
      toast.error(body.error?.message ?? "Saved session but failed to save exercises");
      return;
    }
    toast.success("Workout logged");
    router.replace("/workouts");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="space-y-2">
          <Label htmlFor="name">Session name</Label>
          <Input
            id="name"
            value={name}
            placeholder="e.g. Tuesday walk + bands"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="session_type">Type</Label>
            <select
              id="session_type"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase">Phase</Label>
            <select
              id="phase"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm"
            >
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (min)</Label>
            <Input
              id="duration"
              type="number"
              min={0}
              max={480}
              value={duration}
              onChange={(e) => setDuration(e.target.valueAsNumber || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rpe">RPE (1–10)</Label>
            <Input
              id="rpe"
              type="number"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(e.target.valueAsNumber || 1)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            value={notes}
            placeholder="optional"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Exercises
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={addExercise}>
            <Plus className="h-3 w-3" /> Add exercise
          </Button>
        </div>
        {exercises.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center text-xs text-[var(--color-muted-foreground)]">
            No exercises yet. Add one above.
          </p>
        ) : (
          exercises.map((e, idx) => (
            <div
              key={idx}
              className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={e.name}
                  placeholder="Exercise name"
                  onChange={(ev) => updateExercise(idx, { name: ev.target.value })}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeExercise(idx)}
                  aria-label="Remove"
                  className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <NumCell
                  label="Sets"
                  value={e.sets}
                  onChange={(v) => updateExercise(idx, { sets: v })}
                />
                <NumCell
                  label="Reps"
                  value={e.reps}
                  onChange={(v) => updateExercise(idx, { reps: v })}
                />
                <NumCell
                  label="Load (lb)"
                  value={e.load_lb}
                  step={2.5}
                  onChange={(v) => updateExercise(idx, { load_lb: v })}
                />
                <NumCell
                  label="Min"
                  value={e.duration_min}
                  onChange={(v) => updateExercise(idx, { duration_min: v })}
                />
              </div>
              {e.notes && (
                <p className="text-[10px] italic text-[var(--color-muted-foreground)]">
                  {e.notes}
                </p>
              )}
            </div>
          ))
        )}
      </section>

      <div className="flex gap-3">
        <Button asChild variant="outline" className="flex-1">
          <a href="/workouts">Cancel</a>
        </Button>
        <Button onClick={save} disabled={submitting} className="flex-1">
          {submitting ? "Saving…" : "Save session"}
        </Button>
      </div>
    </div>
  );
}

function NumCell({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number | null;
  step?: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase">{label}</Label>
      <Input
        type="number"
        step={step}
        min={0}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.valueAsNumber)
        }
      />
    </div>
  );
}
