import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CoachClient } from "./coach-client";

export const dynamic = "force-dynamic";

interface ConvRow {
  id: string;
  title: string | null;
  updated_at: string;
}

export default async function CoachPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_conversations")
    .select("id,title,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);
  const conversations = (data ?? []) as ConvRow[];
  return <CoachClient conversations={conversations} />;
}
