"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { stepsLogInput } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { FormCard } from "./form-card";

interface FormShape {
  day: string;
  count: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StepsForm() {
  const router = useRouter();
  const toast = useFireToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormShape>({
    defaultValues: { day: todayISO(), count: 5000 },
  });

  async function onSubmit(values: FormShape) {
    setSubmitting(true);
    const parsed = stepsLogInput.parse({
      day: values.day,
      count: values.count,
    });
    const res = await fetch("/api/log/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...parsed,
        day: parsed.day.toISOString().slice(0, 10),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Could not save steps");
      return;
    }
    toast.success(`${values.count.toLocaleString()} steps logged`);
    reset({ day: todayISO(), count: 5000 });
    router.refresh();
  }

  return (
    <FormCard title="Log steps" subtitle="Total for the day. Updates rather than adds.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="day">Day</Label>
          <Input id="day" type="date" {...register("day")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="count">Step count</Label>
          <Input
            id="count"
            type="number"
            inputMode="numeric"
            {...register("count", { valueAsNumber: true })}
          />
          {errors.count && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.count.message}</p>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Save steps"}
        </Button>
      </form>
    </FormCard>
  );
}
