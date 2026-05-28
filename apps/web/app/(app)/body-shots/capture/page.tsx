import { CaptureFlow } from "./capture-flow";

export const dynamic = "force-dynamic";

export default function CapturePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">New body-shot session</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Four angles in even, consistent lighting. Same time of day, same outfit
          if you can — that&apos;s what makes month-over-month comparison meaningful.
        </p>
      </header>
      <CaptureFlow />
    </div>
  );
}
