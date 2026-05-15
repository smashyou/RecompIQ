"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sleepLogInput } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { FormCard } from "./form-card";

interface FormShape {
  night_of: string;
  hours: number;
  minutes: number;
  quality: number;
  note?: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SleepForm() {
  const router = useRouter();
  const toast = useFireToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormShape>({
    defaultValues: { night_of: todayISO(), hours: 7, minutes: 0, quality: 3 },
  });
  const quality = watch("quality");

  async function onSubmit(values: FormShape) {
    setSubmitting(true);
    const duration_min = Math.max(0, Math.min(1440, values.hours * 60 + values.minutes));
    const payload = sleepLogInput.parse({
      night_of: values.night_of,
      duration_min,
      quality: values.quality,
      note: values.note ?? null,
    });

    const res = await fetch("/api/log/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, night_of: payload.night_of.toISOString().slice(0, 10) }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Could not save sleep");
      return;
    }
    toast.success("Sleep logged");
    reset({ night_of: todayISO(), hours: 7, minutes: 0, quality: 3 });
    router.refresh();
  }

  return (
    <FormCard
      title="Log last night's sleep"
      subtitle="Roughly is fine — pattern matters more than precision."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="night_of">Night of</Label>
          <Input id="night_of" type="date" {...register("night_of")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="hours">Hours</Label>
            <Input
              id="hours"
              type="number"
              min={0}
              max={24}
              {...register("hours", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minutes">Minutes</Label>
            <Input
              id="minutes"
              type="number"
              min={0}
              max={59}
              {...register("minutes", { valueAsNumber: true })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quality">Quality (1–5): {quality}</Label>
          <input
            id="quality"
            type="range"
            min={1}
            max={5}
            step={1}
            {...register("quality", { valueAsNumber: true })}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" placeholder="optional" {...register("note")} />
        </div>
        {Object.keys(errors).length > 0 && (
          <p className="text-xs text-[var(--color-destructive)]">
            {Object.values(errors)[0]?.message ?? "Check your entries"}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Save sleep"}
        </Button>
      </form>
    </FormCard>
  );
}
