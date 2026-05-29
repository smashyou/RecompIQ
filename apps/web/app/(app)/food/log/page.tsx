import Link from "next/link";
import { Camera } from "lucide-react";
import { FoodLogger } from "./logger";

export const dynamic = "force-dynamic";

export default function FoodLogPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Add a meal</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Search by food name. Macros come from USDA FoodData Central with Open Food Facts as
          fallback.
        </p>
      </header>
      <Link
        href="/food/photo"
        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-card)] px-4 py-3 transition-colors hover:bg-[var(--color-muted)]"
      >
        <span className="flex items-center gap-3">
          <Camera className="h-5 w-5 text-[var(--color-primary)]" />
          <span className="space-y-0.5">
            <span className="block text-sm font-semibold">Snap a photo</span>
            <span className="block text-xs text-[var(--color-muted-foreground)]">
              AI identifies items, you review macros, save in seconds.
            </span>
          </span>
        </span>
        <span className="text-xs text-[var(--color-muted-foreground)]">→</span>
      </Link>
      <FoodLogger />
    </div>
  );
}
