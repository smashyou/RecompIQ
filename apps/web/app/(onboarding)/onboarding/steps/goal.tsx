"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { goalStepSchema, type GoalStep } from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GoalStepForm({
  initial,
  onSaved,
  onBack,
}: {
  initial: Record<string, unknown> | null;
  startWeightLb?: number;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoalStep>({
    resolver: zodResolver(goalStepSchema),
    defaultValues: {
      start_weight_lb: (initial?.["start_weight_lb"] as number) ?? 200,
      goal_weight_lb_min: (initial?.["goal_weight_lb_min"] as number) ?? 180,
      goal_weight_lb_max: (initial?.["goal_weight_lb_max"] as number) ?? 190,
      timeline_weeks: (initial?.["timeline_weeks"] as number) ?? 26,
      phase: (initial?.["phase"] as GoalStep["phase"]) ?? "P1",
      protein_target_g_min: (initial?.["protein_target_g_min"] as number) ?? 140,
      protein_target_g_max: (initial?.["protein_target_g_max"] as number) ?? 170,
    },
  });

  async function onSubmit(values: GoalStep) {
    setServerError(null);
    const res = await fetch("/api/onboarding/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      setServerError(body.error?.message ?? "Could not save goal");
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
        <h2 className="text-xl font-semibold">Your goal</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Target a weight <em>range</em>, not a single number — bodies don&apos;t do exact.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="start_weight_lb">Starting weight (lb)</Label>
        <Input
          id="start_weight_lb"
          type="number"
          step="0.1"
          {...register("start_weight_lb", { valueAsNumber: true })}
        />
        {errors.start_weight_lb && (
          <p className="text-xs text-[var(--color-destructive)]">
            {errors.start_weight_lb.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="goal_weight_lb_min">Goal range — low (lb)</Label>
          <Input
            id="goal_weight_lb_min"
            type="number"
            step="0.1"
            {...register("goal_weight_lb_min", { valueAsNumber: true })}
          />
          {errors.goal_weight_lb_min && (
            <p className="text-xs text-[var(--color-destructive)]">
              {errors.goal_weight_lb_min.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="goal_weight_lb_max">Goal range — high (lb)</Label>
          <Input
            id="goal_weight_lb_max"
            type="number"
            step="0.1"
            {...register("goal_weight_lb_max", { valueAsNumber: true })}
          />
          {errors.goal_weight_lb_max && (
            <p className="text-xs text-[var(--color-destructive)]">
              {errors.goal_weight_lb_max.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timeline_weeks">Timeline (weeks)</Label>
        <Input
          id="timeline_weeks"
          type="number"
          {...register("timeline_weeks", { valueAsNumber: true })}
        />
        {errors.timeline_weeks && (
          <p className="text-xs text-[var(--color-destructive)]">{errors.timeline_weeks.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="protein_target_g_min">Protein target (g/day) — low</Label>
          <Input
            id="protein_target_g_min"
            type="number"
            {...register("protein_target_g_min", { valueAsNumber: true })}
          />
          {errors.protein_target_g_min && (
            <p className="text-xs text-[var(--color-destructive)]">
              {errors.protein_target_g_min.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="protein_target_g_max">Protein target (g/day) — high</Label>
          <Input
            id="protein_target_g_max"
            type="number"
            {...register("protein_target_g_max", { valueAsNumber: true })}
          />
          {errors.protein_target_g_max && (
            <p className="text-xs text-[var(--color-destructive)]">
              {errors.protein_target_g_max.message}
            </p>
          )}
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
