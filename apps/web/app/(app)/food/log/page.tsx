import Link from "next/link";
import { Camera } from "lucide-react";
import { FoodLogger } from "./logger";

export const dynamic = "force-dynamic";

export default function FoodLogPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          Add a meal
        </h1>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-[13.5px] text-[var(--fg-subtle)]">
          Search by food name. Macros come from USDA FoodData Central with Open Food Facts as
          fallback.
        </p>
      </header>
      <Link
        href="/food/photo"
        className="flex items-center justify-between gap-3 rounded-[var(--r-lg)] border px-4 py-3 transition-colors"
        style={{ borderColor: "var(--primary-line)", background: "var(--primary-wash)" }}
      >
        <span className="flex items-center gap-3">
          <Camera className="h-5 w-5" style={{ color: "var(--primary)" }} />
          <span>
            <span className="block font-[family-name:var(--font-sans)] text-[13.5px] font-semibold text-foreground">
              Snap a photo
            </span>
            <span className="block font-[family-name:var(--font-sans)] text-[12px] text-[var(--fg-subtle)]">
              AI identifies items, you review macros, save in seconds.
            </span>
          </span>
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--fg-subtle)]">→</span>
      </Link>
      <FoodLogger />
    </div>
  );
}
