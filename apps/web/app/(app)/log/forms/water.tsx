"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { waterLogInput, type WaterLogInput } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { FormCard } from "./form-card";

const QUICK_OZ = [8, 12, 16, 24, 32];

export function WaterForm() {
  const router = useRouter();
  const toast = useFireToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<WaterLogInput>({
    resolver: zodResolver(waterLogInput),
    defaultValues: { logged_at: new Date(), volume_oz: 16 },
  });
  const volume = watch("volume_oz");

  async function onSubmit(values: WaterLogInput) {
    setSubmitting(true);
    const res = await fetch("/api/log/water", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, logged_at: values.logged_at.toISOString() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Could not save water");
      return;
    }
    toast.success(`+${values.volume_oz} oz`);
    reset({ logged_at: new Date(), volume_oz: 16 });
    router.refresh();
  }

  return (
    <FormCard title="Log water" subtitle="Quick taps for common pour sizes.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {QUICK_OZ.map((oz) => (
            <button
              key={oz}
              type="button"
              onClick={() => setValue("volume_oz", oz, { shouldValidate: true })}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                volume === oz
                  ? "border-[var(--color-primary)] bg-[var(--color-muted)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"
              }`}
            >
              {oz} oz
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="volume_oz">Custom (oz)</Label>
          <Input
            id="volume_oz"
            type="number"
            step="0.1"
            {...register("volume_oz", { valueAsNumber: true })}
          />
          {errors.volume_oz && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.volume_oz.message}</p>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Log water"}
        </Button>
      </form>
    </FormCard>
  );
}
