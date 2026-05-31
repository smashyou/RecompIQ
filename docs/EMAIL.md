# Email — RecompIQ

Branded transactional + lifecycle email for RecompIQ. Built with **React Email**
in `packages/email`, rendered to inlined, table-based, email-client-safe HTML
with a plain-text fallback. Dark-first to match the brand; ≤600px; verbatim
safety disclaimer on every message.

> **One outbound path — everything goes through Resend.**
> - **Auth emails** (signup, magic link, recovery, email change) are rendered +
>   sent by our code via the **Supabase Send Email Hook** → Resend. Supabase only
>   mints the token. No templates live in the Supabase dashboard.
> - **Lifecycle emails** are sent by our app via `sendEmail()` → Resend.
> - Identity `noreply@recompiq.com`, sent via the **`send.recompiq.com`** subdomain.
> - **Inbound (receiving) → Cloudflare Email Routing** (already configured:
>   admin/support/billing/john.ryu/legal@recompiq.com → recompiq@gmail.com).
>   **This system does not touch inbound.**

---

## Template inventory

| Group | Template | Sent by | Trigger |
|---|---|---|---|
| **A — auth** | `confirm-signup` | Resend (Supabase Send Email Hook) | New signup, email confirmation |
| A | `magic-link` | Resend (hook) | Passwordless / OTP sign-in / reauth |
| A | `reset-password` | Resend (hook) | Password recovery |
| A | `email-change` | Resend (hook) | Email address change confirmation |
| **B — lifecycle** | `welcome` | Resend (`sendEmail`) | Onboarding complete |
| B | `weekly-summary` | Resend (`sendEmail`) | Weekly progress digest (cron) |
| B | `body-shot-reminder` | Resend (`sendEmail`) | Last progress photo past frequency |
| B | `dose-weigh-in-reminder` | Resend (`sendEmail`) | Daily protocol + weigh-in nudge |
| B | `account-deletion` | Resend (`sendEmail`) | `DELETE /api/me` cascade complete |
| B | `data-export-ready` | Resend (`sendEmail`) | JSON/CSV export finished |

**Group A** is dispatched by `/api/auth/email-hook` (→ `sendAuthEmail`) when
Supabase fires the Send Email hook. **Group B** is sent by our code through
`sendEmail()`. Both render the same React Email templates and go out via Resend.

Every email carries the verbatim disclaimer
(`For educational and research purposes only. Not medical advice. …`). Group B
additionally carries an unsubscribe link + `List-Unsubscribe` headers + the
physical mailing address. Group A (transactional auth) does not — it's not
marketing and must always deliver.

**Notification preferences (Group B reminders only):** `welcome`,
`account-deletion`, and `data-export-ready` are transactional and always send.
The *reminders/summaries* (`weekly-summary`, `body-shot-reminder`,
`dose-weigh-in-reminder`) must be gated by the user's
`user_settings.notification_channel` + per-type toggle via
`shouldEmailReminder(settings, kind)` from `@peptide/shared` before calling
`sendEmail()`. Users set these at **/settings/notifications** (web) or
**More → Notifications** (mobile).

---

## Preview (renders nothing is sent)

```bash
# Static render → packages/email/.preview/*.html + *.txt + index.html
pnpm --filter @peptide/email preview

# Live hot-reload preview UI at http://localhost:3030
pnpm --filter @peptide/email email

# (Re)generate the hosted PNG logo into apps/web/public/email/
pnpm --filter @peptide/email assets
```

The static render is the review artifact. For Group A it emits the Supabase
`{{ .X }}` placeholders intact — that HTML is exactly what you paste.

---

## Environment variables

Add to `apps/web/.env.local` (and Vercel, all 3 environments):

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx     # Resend → API Keys (sending scope)
SEND_EMAIL_HOOK_SECRET=v1,whsec_xxxxxxxx       # from Supabase → Auth → Hooks → Send Email
EMAIL_FROM="RecompIQ <noreply@recompiq.com>"   # optional; this is the default
EMAIL_REPLY_TO=support@recompiq.com            # optional; routes to inbound
EMAIL_MAILING_ADDRESS="RecompIQ · 123 Example St · City, ST 00000"  # required for compliant footer
# NEXT_PUBLIC_APP_URL already set — used for links + the hosted logo PNG.
# CLOUDFLARE_CUSTOM_TOKEN already present — used by the DNS helper below.
```

`RESEND_API_KEY` and `SEND_EMAIL_HOOK_SECRET` are **server-only**.
`@peptide/email/send` reads the key; the package root (`@peptide/email`) never
imports Resend, so client/preview code stays clean. `SEND_EMAIL_HOOK_SECRET` is
the secret Supabase shows when you create the Send Email hook (step 2).

---

## 1 · Outbound DNS (Resend → Cloudflare)

Resend authenticates mail by verifying DNS on the sending subdomain. The exact
DKIM key + SES region are generated **per domain**, so you can't pre-write them —
get them from Resend, then push with the helper.

1. **Resend dashboard → Domains → Add Domain → `send.recompiq.com`.**
2. Resend shows ~4 records. They look like:

   | Type | Name | Value | Notes |
   |---|---|---|---|
   | `TXT` | `send.recompiq.com` | `v=spf1 include:amazonses.com ~all` | SPF |
   | `TXT` | `resend._domainkey.send.recompiq.com` | `p=MIGf…` (long key) | DKIM |
   | `MX`  | `send.recompiq.com` | `feedback-smtp.<region>.amazonses.com` (priority 10) | bounce/return-path |
   | `TXT` | `_dmarc.recompiq.com` | `v=DMARC1; p=none; rua=mailto:admin@recompiq.com` | DMARC (recommended) |

   ⚠️ These are **shapes**, not final values. Copy what Resend actually shows.

3. **Add them to Cloudflare** (zone `d7aedcfa3ad4117463014e8bb41f97f3`):

   ```bash
   cp packages/email/resend-dns.example.json packages/email/resend-dns.json
   # paste Resend's exact values into resend-dns.json, then:
   node packages/email/scripts/add-resend-dns.mjs            # dry run — shows the diff
   node packages/email/scripts/add-resend-dns.mjs --apply    # create/update in Cloudflare
   ```

   The script auto-loads `CLOUDFLARE_CUSTOM_TOKEN` from `apps/web/.env.local`,
   matches existing records by (type, name) so it's idempotent, and **only
   touches the records you list** — it never disturbs the inbound Email Routing
   records on the root domain. (Or just paste them into the Cloudflare DNS UI.)

4. Back in Resend, click **Verify**. Once green, sending is live.

> All four can also be added by hand in the Cloudflare DNS UI. The MX record's
> name `send` and the inbound routing MX on `recompiq.com` (root) don't
> conflict — different hostnames.

---

## 2 · Group A — Supabase auth emails (Send Email Hook → Resend)

Auth emails are rendered + sent by **our code** through Resend. Supabase only
mints the token, then calls our endpoint. No templates in the dashboard, no
manual sync — one Resend path for everything.

### 2a · Deploy the hook endpoint

`apps/web/app/api/auth/email-hook/route.ts` is already implemented. It:
- reads the raw body + `webhook-*` headers and verifies the signature with
  `standardwebhooks` against `SEND_EMAIL_HOOK_SECRET`,
- maps Supabase's `email_action_type` → template + builds the verify URL from the
  token (`planAuthEmail`),
- sends via `sendAuthEmail` (no unsubscribe, always delivers).

It lives at **`https://recompiq.com/api/auth/email-hook`** once deployed.

### 2b · Enable the hook in Supabase

Supabase Dashboard → **Authentication → Hooks** → **Send Email** → enable:

| Field | Value |
|---|---|
| Hook type | HTTPS |
| URI | `https://recompiq.com/api/auth/email-hook` |
| Secret | click generate → copy into `SEND_EMAIL_HOOK_SECRET` (form `v1,whsec_…`) |

Set `SEND_EMAIL_HOOK_SECRET` in `apps/web/.env.local` + Vercel (all 3 envs) to
that secret, then redeploy. From then on Supabase POSTs to the endpoint and our
code sends the mail. (Subjects are defined in code, per template.)

> The verify URL points at `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?...&redirect_to=…`
> — same target `{{ .ConfirmationURL }}` used to expand to. Make sure your
> redirect URLs are allow-listed under Auth → URL Configuration.
> The hosted logo (`<img>`) loads from `NEXT_PUBLIC_APP_URL/email/logo-mark@2x.png` —
> ensure `apps/web/public/email/*.png` is deployed.

### Alternative: Custom SMTP + dashboard templates (no webhook)

If you'd rather not run the hook, you can keep auth on Supabase's sender via
Resend SMTP and paste the static HTML instead:

1. **Auth → SMTP Settings → Custom SMTP:** host `smtp.resend.com`, port `465`
   (or `587`), user `resend`, password = `RESEND_API_KEY`, sender
   `noreply@recompiq.com`, name `RecompIQ`.
2. **Auth → Email Templates:** run `pnpm --filter @peptide/email preview`, then
   paste each `.preview/<name>.html` and set the subject (Confirm signup /
   Magic Link / Reset Password / Change Email Address). The
   `{{ .ConfirmationURL }}` / `{{ .Token }}` / `{{ .Email }}` / `{{ .NewEmail }}`
   placeholders are preserved verbatim — don't hand-edit them.

The hook (2a/2b) is preferred — it keeps all templates in code and avoids the
dashboard-sync drift.

---

## 3 · Group B — app-sent lifecycle emails

Sent by our code via Resend. Render + send is one call:

```ts
import { sendEmail } from "@peptide/email/send";

await sendEmail({
  to: user.email,
  template: "welcome",
  props: { firstName: user.firstName },
});
```

`sendEmail`:
- refuses Group A templates (those are Supabase's job),
- renders inlined HTML + a plain-text part,
- sets `from`/`replyTo` from env,
- sets `List-Unsubscribe` + one-click `List-Unsubscribe-Post` headers using the
  `unsubscribeUrl` on props (or the `/settings/notifications` default),
- accepts an optional `idempotencyKey` to dedupe retries.

### Where each Group B template should be triggered

| Template | Suggested trigger site |
|---|---|
| `welcome` | End of onboarding — after `onboarding_done` flips true (`/api/onboarding` finalize, or the onboarding "done" step). |
| `weekly-summary` | A Vercel cron (e.g. `/api/cron/weekly-summary`, Mon 8:00 local) iterating opted-in users; pull the same snapshot as `loadDashboard()`. |
| `body-shot-reminder` | Reuse the dashboard "photos due" check (`user_settings.body_photo_frequency_days`) in a daily cron, or send when the dashboard banner first appears. |
| `dose-weigh-in-reminder` | Daily cron reading each user's active stack/protocol schedule; only include items the user logged. |
| `account-deletion` | Inside `DELETE /api/me`, after the cascade succeeds, before the auth user is removed (send to the captured address). |
| `data-export-ready` | When an async JSON/CSV export job finishes and a signed Blob URL is ready. |

Example deletion hook:

```ts
// in DELETE /api/me, after cascade
await sendEmail({
  to: deletedEmail,
  template: "account-deletion",
  props: { firstName, effectiveDate: today, exportUrl: finalExportUrl },
});
```

> **Safety boundary:** `dose-weigh-in-reminder` lists the user's **own**
> scheduled items — it never states or suggests a dose amount. Keep it that way.
> Any email that would surface a literal dose must route through the in-app
> dose-quarantine treatment first.

---

## Design + compliance notes

- **Tokens:** `packages/email/src/palette.ts` is the email-safe hex conversion of
  the dark side of `Design/design_handoff_recompiq/colors_and_type.css`, with the
  cyan/green accents taken from the logo gradient (`#1FC2CE → #2FDB92`).
- **Dark-first:** the dark palette is baked in (email has no runtime theme
  toggle). `color-scheme`/`supported-color-schemes` meta hints stop dark-mode
  clients from re-inverting it.
- **Logo:** PNG (not SVG — Gmail/Outlook strip SVG), hosted under
  `apps/web/public/email/`, regenerated by the `assets` script from the brand SVG.
- **Disclaimer copy is fixed.** `DISCLAIMER_LEAD` / `DISCLAIMER_BODY` in
  `src/config.ts` are verbatim from the design's §8 / the legal package — never
  paraphrase per email.
- **Placeholders to finalize before launch:** `EMAIL_MAILING_ADDRESS` (real
  physical address — legally required), and the `LEGAL_ENTITY` / `LEGAL_CONTACT`
  values in `packages/shared/src/legal/types.ts`.
```
