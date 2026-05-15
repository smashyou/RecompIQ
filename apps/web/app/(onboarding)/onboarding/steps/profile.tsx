"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileStepSchema, type ProfileStep, SEX } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileStepForm({
  initial,
  onSaved,
  onBack,
}: {
  initial: Record<string, unknown> | null;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileStep>({
    resolver: zodResolver(profileStepSchema),
    defaultValues: {
      display_name: (initial?.["display_name"] as string) ?? "",
      dob: (initial?.["dob"] as Date | undefined) ?? undefined,
      sex: (initial?.["sex"] as ProfileStep["sex"]) ?? "prefer_not_to_say",
      height_in: (initial?.["height_in"] as number) ?? 70,
      unit_weight: (initial?.["unit_weight"] as ProfileStep["unit_weight"]) ?? "lb",
      unit_length: (initial?.["unit_length"] as ProfileStep["unit_length"]) ?? "in",
    },
  });

  async function onSubmit(values: ProfileStep) {
    setServerError(null);
    const res = await fetch("/api/onboarding/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      setServerError(body.error?.message ?? "Could not save profile");
      return;
    }
    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8"
    >
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">About you</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Anthropometrics drive every downstream personalization. You can edit these later.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Name</Label>
        <Input id="display_name" {...register("display_name")} />
        {errors.display_name && (
          <p className="text-xs text-[var(--color-destructive)]">{errors.display_name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" {...register("dob")} />
          {errors.dob && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.dob.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="sex">Sex</Label>
          <select
            id="sex"
            className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            {...register("sex")}
          >
            {SEX.map((s) => (
              <option key={s} value={s}>
                {s === "prefer_not_to_say" ? "Prefer not to say" : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="height_in">Height (in)</Label>
          <Input
            id="height_in"
            type="number"
            step="0.1"
            {...register("height_in", { valueAsNumber: true })}
          />
          {errors.height_in && (
            <p className="text-xs text-[var(--color-destructive)]">{errors.height_in.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit_weight">Weight units</Label>
          <select
            id="unit_weight"
            className="flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            {...register("unit_weight")}
          >
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>
      </div>

      {serverError && <p className="text-xs text-[var(--color-destructive)]">{serverError}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
