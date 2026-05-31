/**
 * Supabase "Send Email" auth hook → RecompIQ template planner.
 *
 * When the hook is enabled, Supabase mints the token and POSTs this payload to
 * our endpoint instead of sending mail itself. We turn it into a concrete
 * template + props (with the verification URL built from the token), so every
 * auth email is rendered + sent by our code through Resend — one path, no
 * dashboard templates. Pure: no I/O, no secrets.
 */
import type {
  ConfirmSignupProps,
  MagicLinkProps,
  ResetPasswordProps,
  EmailChangeProps,
} from "./types";

/** Supabase auth action types delivered to the Send Email hook. */
export type SupabaseEmailActionType =
  | "signup"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

export interface SupabaseEmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: SupabaseEmailActionType | (string & {});
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
}

export interface SupabaseSendEmailPayload {
  user: { id: string; email: string; new_email?: string | null };
  email_data: SupabaseEmailData;
}

/** A resolved decision: which template to render and with what props. */
export type AuthEmailPlan =
  | { template: "confirm-signup"; props: ConfirmSignupProps }
  | { template: "magic-link"; props: MagicLinkProps }
  | { template: "reset-password"; props: ResetPasswordProps }
  | { template: "email-change"; props: EmailChangeProps };

/**
 * Build the Supabase verification URL — the same target {{ .ConfirmationURL }}
 * expands to. Points at the project's GoTrue `/auth/v1/verify` endpoint, which
 * consumes the token and 302s to `redirect_to`.
 */
function buildVerifyUrl(supabaseUrl: string, data: SupabaseEmailData, tokenHash?: string): string {
  const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash ?? data.token_hash);
  url.searchParams.set("type", data.email_action_type);
  if (data.redirect_to) url.searchParams.set("redirect_to", data.redirect_to);
  return url.toString();
}

/**
 * Map a hook payload to a render plan. Returns null for action types we don't
 * email (the caller should 200 so Supabase doesn't retry). `supabaseUrl` is the
 * project URL (e.g. NEXT_PUBLIC_SUPABASE_URL).
 */
export function planAuthEmail(
  payload: SupabaseSendEmailPayload,
  opts: { supabaseUrl: string },
): AuthEmailPlan | null {
  const { email_data: d } = payload;
  const confirmationUrl = buildVerifyUrl(opts.supabaseUrl, d);

  switch (d.email_action_type) {
    case "signup":
    case "invite":
      return { template: "confirm-signup", props: { confirmationUrl } };
    case "magiclink":
    case "reauthentication":
      return { template: "magic-link", props: { confirmationUrl, token: d.token } };
    case "recovery":
      return { template: "reset-password", props: { confirmationUrl } };
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return {
        template: "email-change",
        props: {
          confirmationUrl,
          email: payload.user.email,
          newEmail: payload.user.new_email ?? undefined,
        },
      };
    default:
      return null;
  }
}

/** Who the rendered email is addressed to for a given payload. */
export function recipientFor(payload: SupabaseSendEmailPayload): string {
  // For email_change_new, the new address is the recipient; otherwise the user's
  // current address. Supabase fires the hook once per address as needed.
  const t = payload.email_data.email_action_type;
  if (t === "email_change_new" && payload.user.new_email) return payload.user.new_email;
  return payload.user.email;
}
