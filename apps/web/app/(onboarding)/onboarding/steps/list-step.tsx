"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldKey = "name" | "detail" | "dose";

interface ListItem {
  name: string;
  detail?: string | null;
  dose?: string | null;
}

const FIELD_LABEL: Record<FieldKey, string> = {
  name: "Name",
  detail: "Notes",
  dose: "Dose",
};
const FIELD_PLACEHOLDER: Record<FieldKey, string> = {
  name: "e.g. Type 2 diabetes",
  detail: "Optional notes",
  dose: "e.g. 500mg twice daily",
};

export function ListStepForm({
  title,
  subtitle,
  endpoint,
  fields,
  initial,
  onSaved,
  onBack,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  fields: FieldKey[];
  initial: Record<string, unknown>[];
  onSaved: () => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ListItem[]>(() =>
    initial.map((i) => ({
      name: (i.name as string) ?? "",
      detail: (i.detail as string | null) ?? null,
      dose: (i.dose as string | null) ?? null,
    })),
  );
  const [draft, setDraft] = useState<ListItem>({ name: "", detail: null, dose: null });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function addDraft() {
    if (!draft.name.trim()) return;
    setItems([...items, { ...draft, name: draft.name.trim() }]);
    setDraft({ name: "", detail: null, dose: null });
  }
  function removeAt(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setServerError(null);
    setSubmitting(true);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((i) => ({ ...i, active: true })) }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      setServerError(body.error?.message ?? "Could not save");
      return;
    }
    onSaved();
  }

  return (
    <div className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-sm"
            >
              <div className="flex-1 space-y-0.5">
                <p className="font-medium">{item.name}</p>
                {fields.includes("dose") && item.dose && (
                  <p className="text-xs text-[var(--color-muted-foreground)]">{item.dose}</p>
                )}
                {fields.includes("detail") && item.detail && (
                  <p className="text-xs text-[var(--color-muted-foreground)]">{item.detail}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                aria-label={`Remove ${item.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-lg border border-dashed border-[var(--color-border)] p-4">
        {fields.map((f) => (
          <div key={f} className="space-y-1.5">
            <Label htmlFor={`draft-${f}`}>{FIELD_LABEL[f]}</Label>
            <Input
              id={`draft-${f}`}
              placeholder={FIELD_PLACEHOLDER[f]}
              value={(draft[f] as string) ?? ""}
              onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
            />
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addDraft} className="w-full">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {serverError && <p className="text-xs text-[var(--color-destructive)]">{serverError}</p>}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={submit} disabled={submitting} className="flex-1">
          {submitting ? "Saving…" : items.length === 0 ? "Skip" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
