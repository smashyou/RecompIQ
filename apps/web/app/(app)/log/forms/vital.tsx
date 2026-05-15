"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vitalLogInput, type VitalLogInput } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFireToast } from "@/components/ui/toast";
import { FormCard } from "./form-card";

export function VitalForm() {
  const router = useRouter();
  const toast = useFireToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VitalLogInput>({
    resolver: zodResolver(vitalLogInput),
    defaultValues: { logged_at: new Date() },
  });

  async function onSubmit(values: VitalLogInput) {
    setSubmitting(true);
    const res = await fetch("/api/log/vital", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, logged_at: values.logged_at.toISOString() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Could not save vitals");
      return;
    }
    toast.success("Vitals logged");
    reset({ logged_at: new Date() });
    router.refresh();
  }

  return (
    <FormCard
      title="Log vitals"
      subtitle="Anything you measured today — leave blank what you didn't."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="bp_systolic">BP — systolic</Label>
            <Input
              id="bp_systolic"
              type="number"
              inputMode="numeric"
              placeholder="120"
              {...register("bp_systolic")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bp_diastolic">BP — diastolic</Label>
            <Input
              id="bp_diastolic"
              type="number"
              inputMode="numeric"
              placeholder="80"
              {...register("bp_diastolic")}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="hr">Heart rate</Label>
            <Input
              id="hr"
              type="number"
              inputMode="numeric"
              placeholder="72"
              {...register("hr")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="glucose_mgdl">Glucose (mg/dL)</Label>
            <Input
              id="glucose_mgdl"
              type="number"
              step="0.1"
              placeholder="140"
              {...register("glucose_mgdl")}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ketones_mmol">Ketones (mmol)</Label>
            <Input
              id="ketones_mmol"
              type="number"
              step="0.1"
              placeholder="0.5"
              {...register("ketones_mmol")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="temp_f">Temp (°F)</Label>
            <Input
              id="temp_f"
              type="number"
              step="0.1"
              placeholder="98.6"
              {...register("temp_f")}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" placeholder="optional context" {...register("note")} />
        </div>
        {/* Top-level refine error: surface as a single message. */}
        {Object.keys(errors).length > 0 && (
          <p className="text-xs text-[var(--color-destructive)]">
            {errors.root?.message ?? Object.values(errors)[0]?.message ?? "Check your entries"}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Saving…" : "Save vitals"}
        </Button>
      </form>
    </FormCard>
  );
}
