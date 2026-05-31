"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useFireToast } from "@/components/ui/toast";
import { postJson } from "@/lib/post-json";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card } from "@/components/kit";

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
    <div className="flex flex-col gap-[18px]">
      {/* Account identity */}
      <Card title="Account">
        <div className="font-[family-name:var(--font-sans)] text-[13px]">
          <span className="text-[var(--fg-muted)]">Email</span>
          <p className="mt-0.5 font-mono text-[13px] text-[var(--fg)]">{email}</p>
        </div>
      </Card>

      {/* Export */}
      <Card title="Export your data">
        <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-muted)]">
          Download a complete copy of everything you&apos;ve logged — profile,
          protocols, doses, weights, workouts, food, photos metadata, and more —
          as a single JSON file. We&apos;ll also email you the download link.
        </p>
        <div className="mt-4">
          <Button onClick={onExport} disabled={exporting}>
            {exporting ? "Preparing…" : "Export my data"}
          </Button>
        </div>
      </Card>

      {/* Danger zone */}
      <Card
        style={{
          border: "1px solid var(--danger)",
          background: "color-mix(in srgb, var(--danger) 6%, var(--surface-1))",
        }}
      >
        <div className="space-y-1">
          <h2 className="font-[family-name:var(--font-sans)] text-[13px] font-semibold text-[var(--danger)]">
            Delete account
          </h2>
          <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-muted)]">
            This permanently deletes your account and all associated data —
            protocols, logs, photos, and AI conversations. This cannot be undone.
            Consider exporting your data first.
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <label
            htmlFor="confirm-delete"
            className="block font-[family-name:var(--font-sans)] text-[13px] font-medium text-[var(--fg)]"
          >
            Type <span className="font-mono font-semibold">DELETE</span> to confirm
          </label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-[13px] text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            placeholder="DELETE"
          />
        </div>
        <div className="mt-4">
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={!canDelete || deleting}
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
