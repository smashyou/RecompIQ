"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { weightLogInput, type WeightLogInput } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { FormCard } from "./form-card";

export function WeightForm() {
  const router = useRouter();
  const toast = useFireToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WeightLogInput>({
    resolver: zodResolver(weightLogInput),
    defaultValues: { unit: "lb", logged_at: new Date() },
  });

  async function onSubmit(values: WeightLogInput) {
    setSubmitting(true);
    const res = await fetch("/api/log/weight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, logged_at: values.logged_at.toISOString() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Could not save weight");
      return;
    }
    toast.success("Weight logged");
    reset({ unit: values.unit, logged_at: new Date() });
    router.refresh();
  }

  return (
    <FormCard title="Log weight" subtitle="Best time: morning, after the bathroom, before food.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="value">Weight</Label>
            <Input
              id="value"
              type="number"
              step="0.1"
              autoFocus
              {...register("value", { valueAsNumber: true })}
            />
            {errors.value && (
              <p className="text-xs text-[var(--color-destructive)]">{errors.value.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <select
              id="unit"
              className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              {...register("unit")}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Input id="note" placeholder="anything off this morning?" {...register("note")} />
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Save weight"}
        </Button>
      </form>
    </FormCard>
  );
}
