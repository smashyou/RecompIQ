import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { AppError } from "@peptide/shared";
import { sendEmail } from "@peptide/email/send";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      data: { user: { id: user.id, email: user.email }, profile },
      error: null,
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { data: null, error: { code: err.code, message: err.message } },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL", message: "Unexpected error" } },
      { status: 500 },
    );
  }
}

/**
 * Permanently delete the authenticated user's account and all of their data.
 *
 * Every user-owned table FKs to auth.users(id) `on delete cascade` (verified in
 * supabase/migrations/*.sql), so removing the auth user via the admin client
 * cascades the row deletes. We only need to clean up out-of-DB resources (Blob
 * assets) explicitly first — those aren't reachable once the rows are gone.
 */
export async function DELETE() {
  try {
    const user = await requireUser();
    const supabase = await createSupabaseServerClient(); // RLS — reads only this user's rows

    // Capture identity BEFORE deletion so we can email the confirmation.
    const email = user.email ?? null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const firstName =
      (profile?.display_name as string | null | undefined)?.trim().split(/\s+/)[0] ?? undefined;

    // Best-effort: delete Blob assets (progress photos + food photos). Failures
    // here must not block account deletion.
    try {
      const urls: string[] = [];

      const { data: bodyPhotos } = await supabase
        .from("body_photos")
        .select("front_url, back_url, left_url, right_url")
        .eq("user_id", user.id);
      for (const row of bodyPhotos ?? []) {
        for (const u of [row.front_url, row.back_url, row.left_url, row.right_url]) {
          if (typeof u === "string" && u) urls.push(u);
        }
      }

      const { data: foodPhotos } = await supabase
        .from("food_photo_assets")
        .select("blob_url")
        .eq("user_id", user.id);
      for (const row of foodPhotos ?? []) {
        if (typeof row.blob_url === "string" && row.blob_url) urls.push(row.blob_url);
      }

      if (urls.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
        // del() accepts an array; one call removes them all.
        await del(urls, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
    } catch (blobErr) {
      console.error("[api/me DELETE] blob cleanup failed (continuing)", blobErr);
    }

    // Delete the auth user (service-role; cascades all user-owned rows).
    const admin = createSupabaseAdminClient();
    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      throw new AppError("UPSTREAM_FAILED", `Account deletion failed: ${deleteErr.message}`);
    }

    // Best-effort confirmation email.
    if (email) {
      try {
        const effectiveDate = new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        await sendEmail({
          to: email,
          template: "account-deletion",
          props: { firstName, effectiveDate },
        });
      } catch (mailErr) {
        console.error("[api/me DELETE] confirmation email failed (continuing)", mailErr);
      }
    }

    return jsonOk({ deleted: true });
  } catch (err) {
    return jsonError(err);
  }
}
