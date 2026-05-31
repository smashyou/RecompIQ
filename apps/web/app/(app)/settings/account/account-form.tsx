"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { postJson } from "@/lib/post-json";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ExportResult {
  url: string;
  expiresAt: string;
}

export function AccountForm({ email }: { email: string }) {
  const router = useRouter();
  const toast = useFireToast();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText === "DELETE";

  async function onExport() {
    setExporting(true);
    const res = await postJson<ExportResult>("/api/me/export", {}, router);
    setExporting(false);
    if (res.ok) {
      toast.success("Export ready — emailed to you.");
      window.open(res.data.url, "_blank", "noopener");
    } else {
      toast.error(res.message ?? "Couldn't create your export.");
    }
  }

  async function onDelete() {
    if (!canDelete) return;
    setDeleting(true);
    let res: Response;
    try {
      res = await fetch("/api/me", { method: "DELETE", credentials: "same-origin" });
    } catch {
      setDeleting(false);
      toast.error("Network error — please try again.");
      return;
    }
    if (!res.ok) {
      setDeleting(false);
      let message = "Couldn't delete your account.";
      try {
        const json = (await res.json()) as { error?: { message?: string } };
        message = json.error?.message ?? message;
      } catch {
        /* keep default */
      }
      toast.error(message);
      return;
    }
    // Sign out locally and bounce to the sign-in page.
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/signin");
  }

  return (
    <div className="space-y-6">
      {/* Account identity */}
      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="text-sm">
          <span className="text-[var(--color-muted-foreground)]">Email</span>
          <p className="font-medium">{email}</p>
        </div>
      </section>

      {/* Export */}
      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Export your data</h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Download a complete copy of everything you&apos;ve logged — profile,
            protocols, doses, weights, workouts, food, photos metadata, and more
            — as a single JSON file. We&apos;ll also email you the download link.
          </p>
        </div>
        <Button onClick={onExport} disabled={exporting}>
          {exporting ? "Preparing…" : "Export my data"}
        </Button>
      </section>

      {/* Danger zone */}
      <section className="space-y-4 rounded-xl border border-[var(--color-destructive)] bg-[color-mix(in_srgb,var(--color-destructive)_6%,var(--color-card))] p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--color-destructive)]">
            Delete account
          </h2>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            This permanently deletes your account and all associated data —
            protocols, logs, photos, and AI conversations. This cannot be undone.
            Consider exporting your data first.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm-delete" className="block text-sm font-medium">
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            placeholder="DELETE"
          />
        </div>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={!canDelete || deleting}
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </Button>
      </section>
    </div>
  );
}
