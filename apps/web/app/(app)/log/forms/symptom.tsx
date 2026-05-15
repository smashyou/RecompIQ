"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { symptomLogInput, type SymptomLogInput } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { FormCard } from "./form-card";

const MOOD_EMOJI = ["😞", "🙁", "😐", "🙂", "😄"];
const ENERGY_EMOJI = ["🪫", "🔋", "⚡", "🔥", "🚀"];

function Picker({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: number | null;
  onChange: (v: number) => void;
  options: string[];
}) {
  return (
    <div className="flex gap-2">
      {options.map((label, i) => {
        const v = i + 1;
        const selected = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-label={`${name} ${v}`}
            onClick={() => onChange(v)}
            className={`flex-1 rounded-md border py-2 text-lg transition-colors ${
              selected
                ? "border-[var(--color-primary)] bg-[var(--color-muted)]"
                : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function SymptomForm() {
  const router = useRouter();
  const toast = useFireToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<SymptomLogInput>({
    resolver: zodResolver(symptomLogInput),
    defaultValues: { logged_at: new Date(), nausea: false, reflux: false, constipation: false },
  });
  const mood = watch("mood") ?? null;
  const energy = watch("energy") ?? null;
  const pain = watch("pain");

  async function onSubmit(values: SymptomLogInput) {
    setSubmitting(true);
    const res = await fetch("/api/log/symptom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, logged_at: values.logged_at.toISOString() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Could not save symptoms");
      return;
    }
    toast.success("Symptoms logged");
    reset({
      logged_at: new Date(),
      nausea: false,
      reflux: false,
      constipation: false,
    });
    router.refresh();
  }

  return (
    <FormCard
      title="How are you feeling today?"
      subtitle="Trend over time matters more than any single day. Be honest."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label>Mood</Label>
          <Picker
            name="mood"
            value={mood ?? null}
            onChange={(v) => setValue("mood", v, { shouldValidate: true })}
            options={MOOD_EMOJI}
          />
        </div>
        <div className="space-y-2">
          <Label>Energy</Label>
          <Picker
            name="energy"
            value={energy ?? null}
            onChange={(v) => setValue("energy", v, { shouldValidate: true })}
            options={ENERGY_EMOJI}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pain">Pain (0–10): {pain ?? 0}</Label>
          <input
            id="pain"
            type="range"
            min={0}
            max={10}
            step={1}
            defaultValue={0}
            {...register("pain", { valueAsNumber: true })}
            className="w-full"
          />
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <label className="flex items-center gap-2 rounded-md border border-[var(--color-border)] p-2">
            <input type="checkbox" {...register("nausea")} />
            Nausea
          </label>
          <label className="flex items-center gap-2 rounded-md border border-[var(--color-border)] p-2">
            <input type="checkbox" {...register("reflux")} />
            Reflux
          </label>
          <label className="flex items-center gap-2 rounded-md border border-[var(--color-border)] p-2">
            <input type="checkbox" {...register("constipation")} />
            Constipation
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="neuro_note">Neurologic symptoms (optional)</Label>
          <Input
            id="neuro_note"
            placeholder="e.g. L foot tingling on long walks"
            {...register("neuro_note")}
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Save symptoms"}
        </Button>
      </form>
    </FormCard>
  );
}
