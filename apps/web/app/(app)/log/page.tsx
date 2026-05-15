import { Suspense } from "react";
import { LogTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default function LogPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Quick log</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Capture today&apos;s numbers in under 30 seconds.
        </p>
      </header>
      <Suspense fallback={<div className="text-sm">Loading…</div>}>
        <LogTabs />
      </Suspense>
    </div>
  );
}
