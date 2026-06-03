"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  goalStepSchema,
  proteinDirection,
  proteinTargetGrams,
  goalWeightMidpoint,
  type GoalStep,
} from "@peptide/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Protein target is goal-aware (g/lb of bodyweight, by weight-goal direction):
// fat loss / GLP-1 ~0.6–0.8, muscle gain ~0.8–1.0, recomposition ~0.7–1.0.
// Evidence-graded defaults live in @peptide/shared (goals/protein). Bounded by
// Zod (20–400 g/day) so extreme inputs don't break submission.

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
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const initialStart = (initial?.["start_weight_lb"] as number) ?? 200;
  const initialGoalMid = goalWeightMidpoint(
    (initial?.["goal_weight_lb_min"] as number) ?? 180,
    (initial?.["goal_weight_lb_max"] as number) ?? 190,
  );
  const hasSavedProtein = initial?.["protein_target_g_min"] !== undefined;
  const initialProtein = hasSavedProtein
    ? {
        low: initial!["protein_target_g_min"] as number,
        high: initial!["protein_target_g_max"] as number,
      }
    : proteinTargetGrams(initialStart, proteinDirection(initialStart, initialGoalMid));
  // Don't auto-overwrite a protein target the user (or a prior session) set.
  const proteinTouched = useRef(hasSavedProtein);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<GoalStep>({
    resolver: zodResolver(goalStepSchema),
    defaultValues: {
      start_weight_lb: initialStart,
      goal_weight_lb_min: (initial?.["goal_weight_lb_min"] as number) ?? 180,
      goal_weight_lb_max: (initial?.["goal_weight_lb_max"] as number) ?? 190,
      timeline_weeks: (initial?.["timeline_weeks"] as number) ?? 26,
      phase: (initial?.["phase"] as GoalStep["phase"]) ?? "P1",
      protein_target_g_min: initialProtein.low,
      protein_target_g_max: initialProtein.high,
    },
  });

  const start = watch("start_weight_lb");
  const goalMin = watch("goal_weight_lb_min");
  const goalMax = watch("goal_weight_lb_max");
  const proteinLow = watch("protein_target_g_min");
  const proteinHigh = watch("protein_target_g_max");

  const goalMid = goalWeightMidpoint(goalMin, goalMax);
  const direction = proteinDirection(start, goalMid);
  const auto = !isNaN(start) && start > 0 ? proteinTargetGrams(start, direction) : null;

  // Re-derive the protein range from start weight + goal direction whenever
  // either changes — unless the user has manually edited the target.
  useEffect(() => {
    if (proteinTouched.current || auto === null) return;
    setValue("protein_target_g_min", auto.low, { shouldValidate: true });
    setValue("protein_target_g_max", auto.high, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, goalMid, direction]);

  const proteinIsAuto =
    auto !== null && proteinLow === auto.low && proteinHigh === auto.high;

  async function onSubmit(values: GoalStep) {
    setServerError(null);
    const res = await fetch("/api/onboarding/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
      credentials: "same-origin",
    });
    if (res.status === 401) {
      router.replace("/signin?next=/onboarding");
      router.refresh();
      return;
    }
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

      <div className="grid grid-cols-1 gap-[var(--space-grid)] sm:grid-cols-2">
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Protein target (g/day)</Label>
          <span className="text-2xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
            {proteinIsAuto && auto
              ? `Auto · ${auto.band.minGPerLb}–${auto.band.maxGPerLb} g/lb · ${auto.band.label}`
              : "Custom"}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-[var(--space-grid)] sm:grid-cols-2">
          <div className="space-y-1">
            <Input
              id="protein_target_g_min"
              type="number"
              {...register("protein_target_g_min", {
                valueAsNumber: true,
                onChange: () => {
                  proteinTouched.current = true;
                },
              })}
            />
            <p className="text-2xs text-[var(--color-muted-foreground)]">Low</p>
            {errors.protein_target_g_min && (
              <p className="text-xs text-[var(--color-destructive)]">
                {errors.protein_target_g_min.message}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Input
              id="protein_target_g_max"
              type="number"
              {...register("protein_target_g_max", {
                valueAsNumber: true,
                onChange: () => {
                  proteinTouched.current = true;
                },
              })}
            />
            <p className="text-2xs text-[var(--color-muted-foreground)]">High</p>
            {errors.protein_target_g_max && (
              <p className="text-xs text-[var(--color-destructive)]">
                {errors.protein_target_g_max.message}
              </p>
            )}
          </div>
        </div>
        <p className="text-2xs text-[var(--color-muted-foreground)]">
          {auto
            ? `Auto-calculated for ${auto.band.label} from your start + goal weight (${auto.band.minGPerLb}–${auto.band.maxGPerLb} g/lb body weight). `
            : "Auto-calculated from your start + goal weight. "}
          Edit if your clinician recommends a different target.
        </p>
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
