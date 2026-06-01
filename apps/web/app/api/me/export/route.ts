import { put } from "@vercel/blob";
import { AppError } from "@peptide/shared";
import { sendEmail } from "@peptide/email/send";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";

// Every user-owned table. RLS scopes each query to the logged-in user, so a
// plain `select("*")` returns only their rows. Global/reference tables
// (compounds, ai_models, peptide_kb, …) are intentionally excluded.
const USER_TABLES = [
  "profiles",
  "goals",
  "conditions",
  "medications",
  "injuries",
  "user_settings",
  "weights",
  "vitals",
  "symptoms",
  "sleep_logs",
  "water_logs",
  "steps_logs",
  "food_logs",
  "food_photo_assets",
  "regimens",
  "regimen_phases",
  "regimen_items",
  "regimen_changes",
  "user_goals",
  "goal_metrics",
  "peptide_purchases",
  "lab_results",
  "peptide_stacks",
  "peptide_stack_items",
  "peptide_doses",
  "reconstitution_records",
  "protocol_schedules",
  "protocol_schedule_weeks",
  "workouts",
  "workout_exercises",
  "body_photos",
  "ai_conversations",
  "ai_messages",
] as const;

const EXPIRY_DAYS = 7;

export async function POST() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient(); // RLS — only their rows

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new AppError(
        "UPSTREAM_FAILED",
        "BLOB_READ_WRITE_TOKEN not configured. Add it in Vercel → Settings → Environment Variables.",
      );
    }

    const data: Record<string, unknown[]> = {};
    for (const table of USER_TABLES) {
      const { data: rows, error } = await supabase.from(table).select("*");
      if (error) {
        throw new AppError("UPSTREAM_FAILED", `Failed to export ${table}: ${error.message}`);
      }
      data[table] = rows ?? [];
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email ?? null },
      data,
    };

    // Upload as a single JSON file. The random suffix makes the URL unguessable.
    // NOTE: true expiry/cleanup is a future cron job (delete exports older than
    // EXPIRY_DAYS). For now the unguessable URL is the access control.
    const blob = await put(
      `exports/${user.id}/recompiq-export-${Date.now()}.json`,
      JSON.stringify(payload, null, 2),
      {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/json",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      },
    );

    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString(
      "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );

    // Capture first name for a friendlier email greeting (best-effort).
    let firstName: string | undefined;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      firstName =
        (profile?.display_name as string | null | undefined)?.trim().split(/\s+/)[0] ?? undefined;
    } catch {
      firstName = undefined;
    }

    // Best-effort delivery email — must not fail the export.
    if (user.email) {
      try {
        await sendEmail({
          to: user.email,
          template: "data-export-ready",
          props: { firstName, downloadUrl: blob.url, expiresAt, formats: "JSON" },
        });
      } catch (mailErr) {
        console.error("[api/me/export] email failed (continuing)", mailErr);
      }
    }

    return jsonOk({ url: blob.url, expiresAt });
  } catch (err) {
    return jsonError(err);
  }
}
