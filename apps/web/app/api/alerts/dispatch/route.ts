import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reconcileUserAlerts } from "@/lib/queries/alerts";
import { dispatchAlertNotifications } from "@/lib/notify/dispatch-alerts";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mobile calls this after its client-side reconcile (Bearer JWT handled by requireUser).
export async function POST() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    await reconcileUserAlerts(supabase, user.id);
    const r = await dispatchAlertNotifications(supabase, user.id, "immediate", {
      email: user.email ?? undefined,
    });
    return jsonOk(r);
  } catch (err) {
    return jsonError(err);
  }
}
