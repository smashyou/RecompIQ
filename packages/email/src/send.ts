/**
 * Server-only Resend wrapper. Do NOT import this from client code — it reads
 * RESEND_API_KEY and pulls the Resend SDK. Import `@peptide/email/render` (or
 * the package root) for the pure render path instead.
 *
 * Two entry points:
 *  - `sendEmail`     → Group B lifecycle emails (adds List-Unsubscribe).
 *  - `sendAuthEmail` → Group A auth emails routed through the Supabase Send
 *                      Email hook (transactional, no unsubscribe, always sends).
 */
import { Resend } from "resend";
import { renderTemplate, renderAuthPlan } from "./render";
import {
  isLifecycle,
  type TemplateName,
  type TemplatePropsMap,
} from "./templates";
import type { AuthEmailPlan } from "./auth-hook";
import { FROM_EMAIL, REPLY_TO, DEFAULT_UNSUBSCRIBE_URL } from "./config";

let cached: Resend | null = null;
function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set — cannot send email. See docs/EMAIL.md.",
    );
  }
  cached ??= new Resend(key);
  return cached;
}

export interface SendEmailResult {
  id: string;
}

interface DeliverArgs {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

/** Single point that actually hits Resend. */
async function deliver(args: DeliverArgs): Promise<SendEmailResult> {
  const { data, error } = await client().emails.send(
    {
      from: FROM_EMAIL,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo: args.replyTo ?? REPLY_TO,
      ...(args.headers ? { headers: args.headers } : {}),
    },
    args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
  );
  if (error) {
    throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
  if (!data) {
    throw new Error("Resend returned no data and no error.");
  }
  return { id: data.id };
}

export interface SendEmailOptions<K extends TemplateName> {
  to: string | string[];
  template: K;
  props: TemplatePropsMap[K];
  /** Override the template's default subject. */
  subject?: string;
  /** Override the default reply-to (support@). */
  replyTo?: string;
  /**
   * Per-user unsubscribe URL. When provided (or present on props) for a
   * lifecycle template, sets the List-Unsubscribe + one-click headers.
   */
  unsubscribeUrl?: string;
  /** Optional Resend idempotency key to dedupe retries. */
  idempotencyKey?: string;
}

/** Render + send a Group B lifecycle template via Resend. Returns the message id. */
export async function sendEmail<K extends TemplateName>(
  opts: SendEmailOptions<K>,
): Promise<SendEmailResult> {
  if (!isLifecycle(opts.template)) {
    throw new Error(
      `Template "${opts.template}" is an auth email — send it via sendAuthEmail() / the Supabase hook, not sendEmail().`,
    );
  }

  const { html, text, subject } = await renderTemplate(opts.template, opts.props);

  // Lifecycle props always extend LifecycleBase, so unsubscribeUrl is present
  // on the prop shape; fall back to the explicit option then the default.
  const propsUnsub = (opts.props as { unsubscribeUrl?: string }).unsubscribeUrl;
  const unsubscribeUrl =
    opts.unsubscribeUrl ?? propsUnsub ?? DEFAULT_UNSUBSCRIBE_URL;

  return deliver({
    to: opts.to,
    subject: opts.subject ?? subject,
    html,
    text,
    replyTo: opts.replyTo,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    idempotencyKey: opts.idempotencyKey,
  });
}

export interface BatchEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Per-user unsubscribe URL; when set, adds the List-Unsubscribe headers. */
  unsubscribeUrl?: string;
}

/**
 * Send many already-rendered lifecycle emails in one shot via Resend's batch
 * endpoint. Chunks at 100 (Resend's per-request cap) and throws on any non-2xx
 * response so the caller can decide whether the run failed. Used by the
 * reminder cron, which renders with `renderTemplate` then hands the array here.
 */
export async function sendEmailBatch(messages: BatchEmailMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set — cannot send email. See docs/EMAIL.md.",
    );
  }

  const BATCH_LIMIT = 100;
  for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
    const chunk = messages.slice(i, i + BATCH_LIMIT);
    const payload = chunk.map((m) => ({
      from: FROM_EMAIL,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      reply_to: REPLY_TO,
      ...(m.unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    }));

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Resend batch send failed: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
      );
    }
  }
}

/**
 * Render + send a Group A auth email resolved from the Supabase Send Email
 * hook. Transactional — no unsubscribe, no preference gating.
 */
export async function sendAuthEmail(
  to: string,
  plan: AuthEmailPlan,
  opts: { idempotencyKey?: string } = {},
): Promise<SendEmailResult> {
  const { html, text, subject } = await renderAuthPlan(plan);
  return deliver({ to, subject, html, text, idempotencyKey: opts.idempotencyKey });
}
