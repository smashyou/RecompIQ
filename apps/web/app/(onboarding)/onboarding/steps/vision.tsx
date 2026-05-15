"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { visionStepSchema, type VisionStep } from "@peptide/shared";
import { Button } from "@/components/ui/button";

const OPTIONS: { value: VisionStep["vision_provider"]; label: string; blurb: string }[] = [
  {
    value: "anthropic",
    label: "Claude (Anthropic)",
    blurb: "Strong reasoning over photos. Good default for portion estimation.",
  },
  {
    value: "openai",
    label: "GPT-4o (OpenAI)",
    blurb: "Battle-tested for structured JSON output from images.",
  },
  {
    value: "google",
    label: "Gemini 2.5 Flash (Google)",
    blurb: "Fastest + cheapest at scale. Great for high-volume logging.",
  },
];

export function VisionStepForm({
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
    watch,
    formState: { isSubmitting },
  } = useForm<VisionStep>({
    resolver: zodResolver(visionStepSchema),
    defaultValues: {
      vision_provider:
        ((initial?.["vision_provider"] as VisionStep["vision_provider"]) ?? "anthropic"),
    },
  });
  const selected = watch("vision_provider");

  async function onSubmit(values: VisionStep) {
    setServerError(null);
    const res = await fetch("/api/onboarding/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      setServerError(body.error?.message ?? "Could not save");
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
        <h2 className="text-xl font-semibold">Vision model for food photos</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Pick which AI parses your meal photos into items + portions. Change anytime in Settings.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              selected === opt.value
                ? "border-[var(--color-primary)] bg-[var(--color-muted)]"
                : "border-[var(--color-border)] hover:bg-[var(--color-muted)]"
            }`}
          >
            <input
              type="radio"
              value={opt.value}
              {...register("vision_provider")}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{opt.blurb}</p>
            </div>
          </label>
        ))}
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
