import Link from "next/link";
import { Camera, ImageIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Body shots</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Periodic 4-angle photos. The scale only tells half the story.
          </p>
        </div>
        <Button asChild>
          <Link href="/body-shots/capture">
            <Camera className="h-4 w-4" /> New session
          </Link>
        </Button>
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 text-[var(--color-muted-foreground)]" />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No sessions yet. Take your first set in even, consistent lighting.
          </p>
        </div>
      ) : (
        <Gallery sessions={sessions} />
      )}
    </div>
  );
}
