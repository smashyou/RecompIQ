import { PhotoFlow } from "./photo-flow";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FoodPhotoPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-semibold tracking-[-0.02em] text-foreground">
          Snap a meal
        </h1>
        <p className="mt-1 font-[family-name:var(--font-sans)] text-[13.5px] text-[var(--fg-subtle)]">
          Photo of your plate → AI identifies items → review and save. Macros come from USDA
          FoodData Central with Open Food Facts as fallback.
        </p>
      </header>
      <PhotoFlow />
    </div>
  );
}
