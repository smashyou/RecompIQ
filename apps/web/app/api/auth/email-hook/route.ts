import { Webhook } from "standardwebhooks";
import {
  planAuthEmail,
  recipientFor,
  type SupabaseSendEmailPayload,
} from "@peptide/email";
import { sendAuthEmail } from "@peptide/email/send";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Supabase Auth "Send Email" hook. Supabase mints the token then POSTs here;
 * we render + send every auth email through Resend (one path, no dashboard
 * templates). Configure in Supabase → Authentication → Hooks → Send Email, with
 * URI https://recompiq.com/api/auth/email-hook and the secret in
 * SEND_EMAIL_HOOK_SECRET. See docs/EMAIL.md.
 *
 * Response contract: 2xx = handled; non-2xx with { error: { http_code, message } }
 * tells Supabase the send failed.
 */
function fail(http_code: number, message: string) {
  return Response.json({ error: { http_code, message } }, { status: http_code });
}

export async function POST(req: Request) {
  const secret = serverEnv.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return fail(500, "Email hook is not configured (SEND_EMAIL_HOOK_SECRET).");
  if (!serverEnv.RESEND_API_KEY) return fail(500, "RESEND_API_KEY is not set.");

  // Raw body is required for signature verification — read before parsing.
  const body = await req.text();
  const headers = {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
  };

  let payload: SupabaseSendEmailPayload;
  try {
    // Supabase shows the secret as "v1,whsec_<base64>"; the lib wants the base64.
    const wh = new Webhook(secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, ""));
    payload = wh.verify(body, headers) as SupabaseSendEmailPayload;
  } catch {
    return fail(401, "Invalid webhook signature.");
  }

  const plan = planAuthEmail(payload, {
    supabaseUrl: serverEnv.NEXT_PUBLIC_SUPABASE_URL,
  });
  // Unknown action type → ack so Supabase doesn't retry; nothing to send.
  // NOTE: GoTrue parses the hook RESPONSE as JSON and rejects a missing
  // Content-Type header ("Invalid Content-Type") — so every success must return
  // a JSON body, not an empty/204 response, or signup/auth-email flows fail.
  if (!plan) return Response.json({});

  try {
    await sendAuthEmail(recipientFor(payload), plan);
  } catch (err) {
    console.error("[auth-email-hook] send failed", err);
    return fail(500, "Failed to send auth email.");
  }
  return Response.json({});
}
