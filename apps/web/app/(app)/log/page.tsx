import { Suspense } from "react";
import { LogTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default function LogPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          Quick log
        </h1>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-[13.5px] text-[var(--fg-subtle)]">
          Capture today&apos;s numbers in under 30 seconds.
        </p>
      </header>
      <Suspense
        fallback={
          <div className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-subtle)]">
            Loading…
          </div>
        }
      >
        <LogTabs />
      </Suspense>
    </div>
  );
}
