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
      <FoodLogger />
    </div>
  );
}
