import { SectionHeader } from "@/components/kit";
import { CaptureFlow } from "./capture-flow";

export const dynamic = "force-dynamic";

export default function CapturePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-[18px]">
      <SectionHeader
        num="12"
        title="New body-shot session"
        note="Four angles, even lighting. Same time of day, same outfit — that makes month-over-month meaningful."
      />
      <CaptureFlow />
    </div>
  );
}
