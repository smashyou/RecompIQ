import Link from "next/link";
import { Camera, ImageIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader } from "@/components/kit";
import { Gallery } from "./gallery";

export const dynamic = "force-dynamic";

interface Session {
  id: string;
  captured_at: string;
  front_url: string | null;
  back_url: string | null;
  left_url: string | null;
  right_url: string | null;
  weight_at_capture_lb: number | null;
  notes: string | null;
}

export default async function BodyShotsPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("body_photos")
    .select(
      "id,captured_at,front_url,back_url,left_url,right_url,weight_at_capture_lb,notes",
    )
    .eq("user_id", user.id)
    .order("captured_at", { ascending: false })
    .limit(60);
  const sessions = (data ?? []) as Session[];

  return (
    <div className="flex w-full flex-col gap-[18px]">
      <SectionHeader
        num="12"
        title="Body shots"
        note="Periodic 4-angle photos. The scale only tells half the story."
      />

      <div className="flex">
        <Button asChild>
          <Link href="/body-shots/capture">
            <Camera className="h-4 w-4" /> New session
          </Link>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card
          style={{
            borderStyle: "dashed",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: 40,
            gap: 12,
          }}
        >
          <ImageIcon size={28} style={{ color: "var(--fg-subtle)" }} />
          <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--fg-muted)]">
            No sessions yet. Take your first set in even, consistent lighting.
          </p>
        </Card>
      ) : (
        <Gallery sessions={sessions} />
      )}
    </div>
  );
}
