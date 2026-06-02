# Alert Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver safety alerts off-app — **critical** alerts emailed + pushed immediately, **warn** alerts in a daily digest — reusing the existing cron + `@peptide/email`, gated by the existing `notify_safety_alerts` + `notification_channel` prefs, with each alert notified exactly once.

**Architecture:** A pure `selectAlertsToNotify` (engine package) decides which un-notified alerts qualify; a server `dispatchAlertNotifications(supabase, userId, mode)` renders + sends email (Resend, new `safety-alert` template) + push (Expo push API), stamps `alerts.notified_at`, and writes the `notification_sends` ledger. The web reconcile-on-load calls it inline for immediate-criticals; mobile calls a `requireUser`-protected `POST /api/alerts/dispatch` (Bearer already handled); the daily cron reconciles every user server-side and dispatches the digest.

**Tech Stack:** TypeScript (strict), Supabase (RLS + migration), Next.js Route Handlers + the existing Vercel cron, Resend (`@peptide/email`), Expo push (`expo-notifications`), Expo/React Native.

**Spec:** `docs/superpowers/specs/2026-06-01-alert-notifications-design.md`

**Conventions:** author `John Ryu <johnminryu@gmail.com>`, NO Claude trailer, `--no-verify`; `git status --short` AFTER every `git add`; add+commit as ONE sequential step (never leave staged changes uncommitted — a concurrent agent may be committing). Gates: `pnpm turbo run typecheck` (16/16) · `pnpm test:alerts` · migration via `node scripts/db-apply.mjs` · `cd apps/mobile && npx expo export -p ios`. `safety-reviewer` on the email/push copy; `schema-guardian` on the migration. Client components never import a value from a `server-only` module.

---

## File Structure

**Migration:** `supabase/migrations/<ts>_alert_notifications.sql` — `alerts.notified_at` + `push_tokens`.

**Engine (pure):** `packages/peptides/src/alerts.ts` — add `selectAlertsToNotify`; `scripts/test-alerts.mjs` — add tests.

**Email:** `packages/email/src/emails/safety-alert.tsx` (new component) + `templates.ts`/`types.ts` registry entries.

**Server (web):**
- `apps/web/lib/notify/push.ts` — `sendPush` (Expo).
- `apps/web/lib/notify/dispatch-alerts.ts` — `dispatchAlertNotifications`.
- `apps/web/lib/queries/alerts.ts` — extract `reconcileUserAlerts(supabase, userId)`; `loadAlerts` calls it + dispatch('immediate').
- `apps/web/lib/alerts-input.ts` — `buildAlertScanInput(supabase, userId)` takes the client.
- `apps/web/app/api/alerts/dispatch/route.ts` — new.
- `apps/web/app/api/cron/reminders/route.ts` — add the `safety_alert` digest.

**Mobile:**
- `apps/mobile/lib/push.ts` — register + upsert token.
- `apps/mobile/app/_layout.tsx` — call register on launch.
- `apps/mobile/lib/alerts.ts` — after reconcile, `apiFetch('/api/alerts/dispatch')`.

---

## Task 1: Migration — notified_at + push_tokens

**Files:** Create `supabase/migrations/20260601220000_alert_notifications.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Off-app alert notifications: stamp when an alert was notified (once), and
-- store Expo push tokens per device. RLS user-scoped.

alter table alerts add column if not exists notified_at timestamptz;
-- partial index: the dispatcher scans open, not-yet-notified alerts
create index if not exists alerts_user_unnotified_idx
  on alerts(user_id) where notified_at is null and status = 'open';

create table if not exists push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios','android')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index if not exists push_tokens_user_token_idx on push_tokens(user_id, token);
create index if not exists push_tokens_user_idx on push_tokens(user_id);

alter table push_tokens enable row level security;
create policy push_tokens_select on push_tokens for select using (auth.uid() = user_id);
create policy push_tokens_insert on push_tokens for insert with check (auth.uid() = user_id);
create policy push_tokens_update on push_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy push_tokens_delete on push_tokens for delete using (auth.uid() = user_id);

-- DOWN:
--   drop table if exists push_tokens;
--   drop index if exists alerts_user_unnotified_idx;
--   alter table alerts drop column if exists notified_at;
```

- [ ] **Step 2: schema-guardian**

Dispatch `schema-guardian` over the migration. Expect: RLS on `push_tokens` (4 policies), unique `(user_id, token)`, `alerts.notified_at` nullable, reversible. The `alerts` audit trigger already covers the new column. Fix blockers.

- [ ] **Step 3: Apply + verify**

Run: `node scripts/db-apply.mjs supabase/migrations/20260601220000_alert_notifications.sql`
Verify: insert + delete a demo `push_tokens` row (user `11111111-1111-1111-1111-111111111111`), confirm the unique index rejects a duplicate `(user_id, token)`. Confirm `alerts.notified_at` exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601220000_alert_notifications.sql
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): alerts.notified_at + push_tokens table" --no-verify
```

---

## Task 2: Selection logic (pure, TDD)

**Files:** Modify `packages/peptides/src/alerts.ts`, `scripts/test-alerts.mjs`

- [ ] **Step 1: Add failing tests**

Append to `scripts/test-alerts.mjs` (add `selectAlertsToNotify` to the import):

```js
const A = (severity, notified_at = null, status = "open") => ({
  id: severity + (notified_at ?? ""), severity, status, notified_at,
  title: "t", message: "m", kind: "bp_high", evidence_level: "FDA_APPROVED", citation: "c",
});

it("selectAlertsToNotify: disabled when toggle off or channel off/in_app", () => {
  const alerts = [A("critical")];
  assert.equal(selectAlertsToNotify(alerts, { mode: "immediate", channel: "both", enabled: false }).toSend.length, 0);
  assert.equal(selectAlertsToNotify(alerts, { mode: "immediate", channel: "off", enabled: true }).toSend.length, 0);
  assert.equal(selectAlertsToNotify(alerts, { mode: "immediate", channel: "in_app", enabled: true }).toSend.length, 0);
});

it("selectAlertsToNotify: immediate = critical only; digest = critical+warn; never info", () => {
  const alerts = [A("critical"), A("warn"), A("info")];
  const imm = selectAlertsToNotify(alerts, { mode: "immediate", channel: "email", enabled: true });
  assert.deepEqual(imm.toSend.map((a) => a.severity), ["critical"]);
  const dig = selectAlertsToNotify(alerts, { mode: "digest", channel: "email", enabled: true });
  assert.deepEqual(dig.toSend.map((a) => a.severity).sort(), ["critical", "warn"]);
});

it("selectAlertsToNotify: skips already-notified and non-open", () => {
  const alerts = [A("critical", "2026-06-01T00:00:00Z"), A("warn", null, "acknowledged")];
  assert.equal(selectAlertsToNotify(alerts, { mode: "digest", channel: "both", enabled: true }).toSend.length, 0);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test:alerts` → FAIL (`selectAlertsToNotify` not exported).

- [ ] **Step 3: Implement**

Append to `packages/peptides/src/alerts.ts`:

```ts
export type NotifyChannel = "off" | "in_app" | "email" | "both";

export interface NotifiableAlert {
  id: string;
  severity: AlertSeverity;
  status: "open" | "acknowledged" | "resolved";
  notified_at: string | null;
}

/** Pure: choose which un-notified open alerts to send for a mode + channel. */
export function selectAlertsToNotify<T extends NotifiableAlert>(
  alerts: T[],
  opts: { mode: "immediate" | "digest"; channel: NotifyChannel; enabled: boolean },
): { toSend: T[]; wouldSend: boolean } {
  const externalOn = opts.enabled && (opts.channel === "email" || opts.channel === "both");
  if (!externalOn) return { toSend: [], wouldSend: false };
  const allowed = opts.mode === "immediate"
    ? new Set(["critical"])
    : new Set(["critical", "warn"]);
  const toSend = alerts.filter(
    (a) => a.status === "open" && a.notified_at === null && allowed.has(a.severity),
  );
  return { toSend, wouldSend: toSend.length > 0 };
}
```

Note: `AlertSeverity` is already imported in this file (from the engine's existing imports). If not, add it to the `@peptide/shared` import.

- [ ] **Step 4: Run, verify pass + typecheck**

Run: `pnpm test:alerts` (green) · `pnpm turbo run typecheck` (16/16).

- [ ] **Step 5: Commit**

```bash
git add packages/peptides/src/alerts.ts scripts/test-alerts.mjs
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): pure selectAlertsToNotify (TDD)" --no-verify
```

---

## Task 3: Email template — safety-alert

**Files:** Create `packages/email/src/emails/safety-alert.tsx`; Modify `packages/email/src/templates.ts`, `packages/email/src/types.ts`

- [ ] **Step 1: Read the pattern**

Read `packages/email/src/emails/dose-weigh-in-reminder.tsx` (a Group-B lifecycle email) and `packages/email/src/types.ts` to mirror: a default-exported React component taking a typed Props, using the shared layout/components + `palette`.

- [ ] **Step 2: Add the Props type**

In `packages/email/src/types.ts`, add:

```ts
export interface SafetyAlertEmailProps {
  firstName?: string;
  alerts: {
    title: string;
    message: string;
    severity: "critical" | "warn";
    evidenceLevel: string;
    citation: string;
  }[];
  alertsUrl: string; // absolute link to /alerts
}
```

- [ ] **Step 3: Write the component**

Create `packages/email/src/emails/safety-alert.tsx` mirroring `dose-weigh-in-reminder.tsx`'s structure (same layout wrapper + components + palette). Render: a heading "Safety alert(s) to review", an intro line "RecompIQ flagged the following in your logged data — these are observations to discuss with your clinician, not medical advice." then a list of `alerts` (each: title, a small severity tag, the message, the evidence-level + citation in muted text), a button/link to `alertsUrl` ("View in RecompIQ"), and the standard disclaimer footer the other lifecycle emails use ("Educational tracking only. Not medical advice…"). NO dose/instruction text — render `message`/`title` verbatim (they come from the vetted catalog).

- [ ] **Step 4: Register the template**

In `packages/email/src/templates.ts`:
- import the component + a subject const `const safetyAlertSubject = "Safety alert(s) to review"` (or define alongside the others),
- add to `TemplatePropsMap`: `"safety-alert": SafetyAlertEmailProps;`
- add to the `templates` registry (Group B): `"safety-alert": { group: "lifecycle", subject: safetyAlertSubject, Component: SafetyAlert },`
- import `SafetyAlertEmailProps` from `./types`.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16 (the registry is exhaustively typed; a missing field will fail here).

```bash
git add packages/email/src/emails/safety-alert.tsx packages/email/src/templates.ts packages/email/src/types.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): safety-alert email template" --no-verify
```

---

## Task 4: Push helper (Expo)

**Files:** Create `apps/web/lib/notify/push.ts`

- [ ] **Step 1: Implement sendPush**

Create `apps/web/lib/notify/push.ts`:

```ts
import "server-only";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicketResponse {
  data?: { status: "ok" | "error"; details?: { error?: string } }[];
}

/**
 * Send an Expo push to the given tokens. Best-effort: returns the count
 * delivered (status ok). Returns the tokens Expo reports as DeviceNotRegistered
 * so the caller can prune them. No third-party account — uses Expo's push API.
 */
export async function sendPush(
  tokens: string[],
  payload: PushPayload,
): Promise<{ sent: number; invalidTokens: string[] }> {
  const valid = tokens.filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"));
  if (valid.length === 0) return { sent: 0, invalidTokens: [] };
  const messages = valid.map((to) => ({ to, sound: "default", title: payload.title, body: payload.body, data: payload.data ?? {} }));
  const invalidTokens: string[] = [];
  let sent = 0;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      const json = (await res.json()) as ExpoTicketResponse;
      (json.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(chunk[idx]!.to);
      });
    } catch {
      // best-effort: a push failure must never break the caller
    }
  }
  return { sent, invalidTokens };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/lib/notify/push.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): Expo push send helper" --no-verify
```

---

## Task 5: Refactor scan-input + reconcile to take a supabase client

**Files:** Modify `apps/web/lib/alerts-input.ts`, `apps/web/lib/queries/alerts.ts`

The cron uses the admin client; the web loader uses the per-request server client. Both must run the same reconcile, so they take the client as a parameter.

- [ ] **Step 1: `buildAlertScanInput` takes the client**

In `apps/web/lib/alerts-input.ts`, change the signature from `buildAlertScanInput(userId)` (which creates its own client) to `buildAlertScanInput(supabase, userId)` accepting `supabase` (a `SupabaseClient`). Remove the internal client creation; use the passed client. Keep everything else identical.

- [ ] **Step 2: Extract `reconcileUserAlerts(supabase, userId)`**

In `apps/web/lib/queries/alerts.ts`, extract the scan→reconcile→insert/bump/resolve body of `loadAlerts` into an exported `reconcileUserAlerts(supabase, userId): Promise<void>` that does steps 1–2 (build input via the passed client, `scanRecentLogs`, read existing, `reconcileAlerts`, perform insert/bump/resolve). `loadAlerts(userId)` becomes: create the server client, `await reconcileUserAlerts(supabase, userId)`, then read back active/history/openCount (step 3) as before. (Pass the same `supabase` into `buildAlertScanInput`.)

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16 (any caller of the old `buildAlertScanInput(userId)` signature breaks here — update it).

```bash
git add apps/web/lib/alerts-input.ts apps/web/lib/queries/alerts.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "refactor(notify): scan-input + reconcile take a supabase client (reuse in cron)" --no-verify
```

---

## Task 6: Dispatch module

**Files:** Create `apps/web/lib/notify/dispatch-alerts.ts`

- [ ] **Step 1: Implement**

Create `apps/web/lib/notify/dispatch-alerts.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAlertsToNotify, type NotifyChannel, type NotifiableAlert } from "@peptide/peptides/alerts";
import { sendEmail } from "@peptide/email/send";
import { sendPush } from "@/lib/notify/push";

interface AlertRow extends NotifiableAlert {
  title: string;
  message: string;
  evidence_level: string;
  citation: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://recompiq.com";

/**
 * Send email + push for the user's un-notified alerts (mode = immediate→critical
 * only, digest→critical+warn). Stamps notified_at on what was sent and writes the
 * daily idempotency ledger. Best-effort: I/O failures are swallowed; notified_at
 * is only stamped when at least one channel succeeded.
 */
export async function dispatchAlertNotifications(
  supabase: SupabaseClient,
  userId: string,
  mode: "immediate" | "digest",
  ctx?: { email?: string; channel?: NotifyChannel; enabled?: boolean },
): Promise<{ emailed: boolean; pushed: number }> {
  // settings (load if not provided)
  let channel = ctx?.channel;
  let enabled = ctx?.enabled;
  if (channel === undefined || enabled === undefined) {
    const { data } = await supabase
      .from("user_settings")
      .select("notification_channel, notify_safety_alerts")
      .eq("user_id", userId)
      .maybeSingle();
    channel = (data?.notification_channel as NotifyChannel) ?? "both";
    enabled = Boolean(data?.notify_safety_alerts ?? true);
  }

  const { data: rows } = await supabase
    .from("alerts")
    .select("id,severity,status,notified_at,title,message,evidence_level,citation")
    .eq("user_id", userId)
    .is("notified_at", null)
    .eq("status", "open");
  const alerts = (rows ?? []) as AlertRow[];

  const { toSend } = selectAlertsToNotify(alerts, { mode, channel, enabled });
  if (toSend.length === 0) return { emailed: false, pushed: 0 };

  const sevRank = { critical: 0, warn: 1, info: 2 } as Record<string, number>;
  toSend.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  let emailed = false;
  let pushed = 0;

  // email
  if (channel === "email" || channel === "both") {
    const email = ctx?.email ?? (await resolveEmail(supabase, userId));
    if (email) {
      try {
        await sendEmail({
          to: email,
          name: "safety-alert",
          props: {
            alerts: toSend.map((a) => ({
              title: a.title, message: a.message,
              severity: a.severity as "critical" | "warn",
              evidenceLevel: a.evidence_level, citation: a.citation,
            })),
            alertsUrl: `${APP_URL}/alerts`,
          },
        });
        emailed = true;
      } catch {
        /* best-effort */
      }
    }
  }

  // push
  if (channel === "both") {
    const { data: toks } = await supabase.from("push_tokens").select("token").eq("user_id", userId);
    const tokens = (toks ?? []).map((t) => t.token as string);
    if (tokens.length > 0) {
      const top = toSend[0]!;
      const extra = toSend.length > 1 ? ` and ${toSend.length - 1} more` : "";
      const { sent, invalidTokens } = await sendPush(tokens, {
        title: "RecompIQ safety alert",
        body: `${top.title}${extra}`,
        data: { url: "/alerts" },
      });
      pushed = sent;
      if (invalidTokens.length > 0) {
        await supabase.from("push_tokens").delete().eq("user_id", userId).in("token", invalidTokens);
      }
    }
  }

  // stamp notified_at only if something went out (else retry next run)
  if (emailed || pushed > 0) {
    const nowIso = new Date().toISOString();
    await supabase.from("alerts").update({ notified_at: nowIso }).in("id", toSend.map((a) => a.id));
    // daily idempotency ledger (digest dedupe)
    await supabase.from("notification_sends").insert({ user_id: userId, kind: "safety_alert", sent_on: nowIso.slice(0, 10) }).then(() => {}, () => {});
  }
  return { emailed, pushed };
}

async function resolveEmail(supabase: SupabaseClient, userId: string): Promise<string | null> {
  // admin client can read auth users; fall back to null otherwise.
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}
```

> Verify the `sendEmail` call shape against `packages/email/src/send.ts` `SendEmailOptions` (Task 0 read): it takes `{ to, name, props }` typed by template name. Verify `notification_sends` columns (`user_id, kind, sent_on`) against `supabase/migrations/20260531100000_notification_sends.sql`; adjust the insert to the real column names. Verify `NEXT_PUBLIC_APP_URL` (or the existing app-url env/const — grep `recompiq.com`/`APP_URL` in `apps/web/lib`) and use the established one.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/lib/notify/dispatch-alerts.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): dispatchAlertNotifications (email + push + stamp)" --no-verify
```

---

## Task 7: Web immediate-critical + dispatch route

**Files:** Modify `apps/web/lib/queries/alerts.ts`; Create `apps/web/app/api/alerts/dispatch/route.ts`

- [ ] **Step 1: Fire immediate-critical inline in loadAlerts**

In `apps/web/lib/queries/alerts.ts` `loadAlerts`, after `reconcileUserAlerts(supabase, userId)` and before/after the read-back, call `await dispatchAlertNotifications(supabase, userId, "immediate")` wrapped so a failure never breaks the page:

```ts
import { dispatchAlertNotifications } from "@/lib/notify/dispatch-alerts";
// … after reconcileUserAlerts(supabase, userId):
try { await dispatchAlertNotifications(supabase, userId, "immediate"); } catch { /* best-effort */ }
```

(The per-request server client lacks `auth.admin` — `resolveEmail` will fall back; pass the email explicitly: get it from the session user the page already has via `requireUser`, and pass `{ email: user.email }` into the dispatch call. Update `loadAlerts(userId)` to also accept the email, or read it in the page and pass through. Simplest: have the `/alerts` page + dashboard pass `user.email` into `loadAlerts`, which forwards it to dispatch.)

- [ ] **Step 2: The dispatch route (mobile immediate)**

Create `apps/web/app/api/alerts/dispatch/route.ts`:

```ts
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
    const r = await dispatchAlertNotifications(supabase, user.id, "immediate", { email: user.email ?? undefined });
    return jsonOk(r);
  } catch (err) { return jsonError(err); }
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/lib/queries/alerts.ts apps/web/app/api/alerts/dispatch/route.ts apps/web/app/\(app\)/alerts/page.tsx apps/web/app/\(app\)/dashboard/page.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): web immediate-critical dispatch + /api/alerts/dispatch route" --no-verify
```

---

## Task 8: Cron — safety_alert digest

**Files:** Modify `apps/web/app/api/cron/reminders/route.ts`

- [ ] **Step 1: Add the digest per user**

In the per-user loop in `/api/cron/reminders` (it already loads `settings` incl. `notify_safety_alerts` + has the admin `supabase` + `user.email`), after the existing reminder kinds, add (best-effort, never throwing out of the loop):

```ts
// ---- safety alerts (digest) ----
try {
  await reconcileUserAlerts(supabase, user.id);
  await dispatchAlertNotifications(supabase, user.id, "digest", {
    email: user.email,
    channel: settings.notification_channel as NotifyChannel,
    enabled: settings.notify_safety_alerts,
  });
} catch (e) {
  redactedLogger.warn(`[cron/reminders] safety-alert dispatch failed for ${user.id}`);
}
```

Add imports at the top: `import { reconcileUserAlerts } from "@/lib/queries/alerts";`, `import { dispatchAlertNotifications } from "@/lib/notify/dispatch-alerts";`, `import type { NotifyChannel } from "@peptide/peptides/alerts";` (and `redactedLogger` if not already imported — check; the cron likely already logs). The dispatch handles its own idempotency (`notified_at` + the ledger), so it does NOT go through the `EligibleEmail`/`notification_sends` dedupe batch — it's a direct call.

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/app/api/cron/reminders/route.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): cron sends the daily safety-alert digest (reconciles inactive users too)" --no-verify
```

---

## Task 9: Mobile push token capture

**Files:** add `expo-notifications` + `expo-device`; Create `apps/mobile/lib/push.ts`; Modify `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Install the deps**

Run: `cd apps/mobile && npx expo install expo-notifications expo-device && cd ../..`
(This pins Expo-SDK-54-compatible versions. Per the mobile install model, the root `.npmrc` `node-linker=hoisted` + React override stay; do not remove them.)

- [ ] **Step 2: Implement registration**

Create `apps/mobile/lib/push.ts`:

```ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

/** Request permission, get the Expo push token, upsert it for the user. No-ops on
 *  simulators / denied permission. Call on launch when a session exists. */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const projectId =
      (Notifications as unknown as { default?: unknown });
    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token = tokenResp.data;
    if (!token) return;
    await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, token, platform: Platform.OS === "ios" ? "ios" : "android", last_seen_at: new Date().toISOString() },
        { onConflict: "user_id,token" },
      );
  } catch {
    /* best-effort */
  }
}
```

> If `getExpoPushTokenAsync` requires a `projectId` under SDK 54 (EAS), read `app.json`/`app.config` `extra.eas.projectId` and pass `{ projectId }`. Verify by running the export gate; adjust if the token fetch warns. Remove the unused `projectId` placeholder line.

- [ ] **Step 3: Call on launch**

In `apps/mobile/app/_layout.tsx`, where a session is available (inside `SessionProvider` consumer or the existing session `useEffect`), call `registerPushToken(session.user.id)` once when a session exists. Read the file to place it correctly (mirror how the session is consumed). Keep it fire-and-forget.

- [ ] **Step 4: Gate + commit**

Run: `cd apps/mobile && npx expo export -p ios && cd ../..` (clean) · `pnpm turbo run typecheck` (16/16).

```bash
git add apps/mobile/lib/push.ts apps/mobile/app/_layout.tsx apps/mobile/package.json package.json pnpm-lock.yaml apps/mobile/app.json
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): mobile Expo push-token capture on launch" --no-verify
```

---

## Task 10: Mobile immediate dispatch call

**Files:** Modify `apps/mobile/lib/alerts.ts`

- [ ] **Step 1: Call dispatch after reconcile**

In `apps/mobile/lib/alerts.ts`, after the client-side reconcile writes (insert/bump/resolve), call the dispatch route best-effort so critical alerts fire email/push:

```ts
import { apiFetch } from "@/lib/api";
// … after the reconcile writes, before/after read-back:
try { await apiFetch("/api/alerts/dispatch", { method: "POST", body: "{}" }); } catch { /* best-effort */ }
```

(`apiFetch` already attaches the Supabase Bearer token; `requireUser` on the route validates it.)

- [ ] **Step 2: Gate + commit**

Run: `pnpm turbo run typecheck` (16/16) · `cd apps/mobile && npx expo export -p ios && cd ../..` (clean).

```bash
git add apps/mobile/lib/alerts.ts
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): mobile triggers immediate-critical dispatch after reconcile" --no-verify
```

---

## Task 11: Settings — confirm the safety-alerts toggle is exposed

**Files:** (verify) `apps/web/app/(app)/settings/notifications/notifications-form.tsx`, `apps/mobile/app/(tabs)/more/notifications.tsx`

- [ ] **Step 1: Verify the toggle exists, add if missing**

`notify_safety_alerts` is already a column + selected by the cron. Confirm the web + mobile notification settings forms render a toggle for it (grep `notify_safety_alerts` in both files). If present → no change. If absent → add the toggle row (mirror the adjacent `notify_dose_reminders`/`notify_weekly_summary` toggles; the settings API route already persists the field). Add a one-line helper: "Critical alerts are sent right away; others in a daily summary."

- [ ] **Step 2: Typecheck + commit (only if changed)**

Run: `pnpm turbo run typecheck` → 16/16.

```bash
git add apps/web/app/\(app\)/settings/notifications/notifications-form.tsx apps/mobile/app/\(tabs\)/more/notifications.tsx
git status --short
git -c user.name="John Ryu" -c user.email="johnminryu@gmail.com" commit -m "feat(notify): expose safety-alerts toggle in notification settings" --no-verify
```

---

## Task 12: Safety review + deploy + live verify

- [ ] **Step 1: safety-reviewer**

Dispatch `safety-reviewer` over `packages/email/src/emails/safety-alert.tsx`, `apps/web/lib/notify/dispatch-alerts.ts`, and the push payload. Expect: email/push content is the engine/catalog's non-prescribing copy (observation + clinician framing), the disclaimer footer is present, no dose/instruction text is added, info-severity alerts are never sent. 0 blockers.

- [ ] **Step 2: Gates + push**

```bash
pnpm turbo run typecheck     # 16/16
pnpm test:alerts             # green
pnpm test:timeline           # green (regression)
cd apps/mobile && npx expo export -p ios && cd ../..   # clean
git push origin main
```
Confirm the Vercel deploy reaches READY.

- [ ] **Step 3: Live e2e**

The demo user trips a critical (BP 166/99, glucose 264) + a warn. With `RESEND_API_KEY` set in prod: open `/alerts` as the demo user (fires immediate dispatch) OR trigger the cron once (`curl -H "authorization: Bearer $CRON_SECRET" https://recompiq.vercel.app/api/cron/reminders`) and confirm (a) an email is sent to the demo address, (b) the demo alerts' `notified_at` is stamped (query `alerts`), (c) re-running does NOT re-send (notified_at set). Note: push requires a real device token; verify the push *path* via a unit/manual check rather than a simulator.

- [ ] **Step 4: Update session state**

Append a `🔀 SESSION HANDOFF` block to `.claude/SESSION-STATE.md`: alert notifications shipped (email immediate-critical + daily warn digest + Expo push), the `dispatchAlertNotifications` module, `notified_at`/`push_tokens`, the reused cron, and that mobile→server Bearer auth was already available via `requireUser`+`apiFetch`. Remaining carryover: granular push toggle, real-time warn push, the minor alerts-polish items, timeline dose-tone tokens.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §4 data → Task 1. §5 selection → Task 2. §6 dispatch → Task 6. §7 channels → Task 2/6 (`selectAlertsToNotify` + dispatch gating). §8 immediate (web inline + mobile route) → Tasks 7 + 10. §9 cron digest → Task 8. §10 push infra → Tasks 4 (server) + 9 (mobile). §11 email template → Task 3. §12 safety → Task 12. §13 testing → Tasks 2/12. Settings (§7 prefs) → Task 11.
- **Simplification vs spec:** the spec worried about building mobile→server auth; the codebase already has it (`requireUser` validates Bearer; mobile `apiFetch` attaches it), so Task 7/10 reuse it — no new auth.
- **Placeholder scan:** core logic (migration, selection, push, dispatch, cron, routes) is full code. Task 3 (React email) + Task 9 step 3 (mobile launch placement) name the exact mirror file + fields rather than transcribing boilerplate — intentional for the view/boilerplate layer. Several "verify X against the real file" notes are deliberate guardrails (notification_sends columns, sendEmail shape, expo projectId, app-url env), not placeholders.
- **Type consistency:** `selectAlertsToNotify`/`NotifyChannel`/`NotifiableAlert`/`dispatchAlertNotifications`/`reconcileUserAlerts`/`buildAlertScanInput(supabase,userId)` are consistent across engine, dispatch, loader, route, and cron; the email template name `"safety-alert"` + `SafetyAlertEmailProps` match between Task 3 and Task 6.
