# Alert Notifications — Design Spec

> Phase-8 follow-on: deliver safety alerts off-app via email + mobile push.
> Status: approved 2026-06-01. Builds on the existing cron + `@peptide/email`.

## 1. Goal

Notify a user off-app when the safety-alert engine raises a new alert, so safety
signals reach them even when they don't open the app. **Critical** alerts go out
**immediately**; **warn** alerts go out in a **daily digest**. Two channels:
**email** (existing infra) + **mobile push** (new). The already-present-but-unused
`notify_safety_alerts` preference finally does something.

Non-negotiable: notification content is the same vetted, non-prescribing alert
copy — observation + "discuss with your clinician" + evidence badge — never a
dose or instruction.

## 2. What already exists (reused, not rebuilt)

- Daily Vercel cron `/api/cron/reminders` (13:00 UTC; per-user, timezone-aware)
  sending `weekly_summary` / `body_shot` / `dose_weigh_in`, with the
  `notification_sends` idempotency ledger and `sendEmailBatch` from
  `@peptide/email/send`. It already *reads* `notify_safety_alerts` but acts on
  nothing.
- `@peptide/email` (render + send + templates), `notification_channel` enum
  (`off`/`in_app`/`email`/`both`), per-type toggles incl. `notify_safety_alerts`,
  user timezone, settings UI (web + mobile).
- The alert engine (`@peptide/peptides/alerts`) + `alerts` table (audited) +
  reconcile-on-load (web `loadAlerts`, mobile `lib/alerts.ts`).

## 3. Build order (one combined plan)

1. **Data**: `alerts.notified_at` column + `push_tokens` table (migration,
   schema-guardian).
2. **Selection logic** (pure, tested): which alerts qualify given mode + prefs +
   `notified_at`.
3. **Dispatch module** (server): render + send email/push, stamp `notified_at`,
   write the ledger.
4. **Push infra**: mobile token capture (`expo-notifications`) + `sendPush`
   (Expo push API) server helper.
5. **Wiring**: immediate-critical (web inline + mobile `POST /api/alerts/dispatch`
   with Supabase-JWT Bearer) + daily digest (cron `safety_alert` kind).
6. **Email template** + safety pass + demo verification.

## 4. Data model

- `alerts.notified_at timestamptz` — null = not yet notified. Each alert is
  notified **once**, when it first appears; never re-nagged. (The `alerts` audit
  trigger already covers it.)
- `push_tokens { id uuid pk, user_id uuid fk→auth.users, token text, platform
  text ('ios'|'android'), created_at, last_seen_at }` — RLS user-scoped (4
  policies); unique on `(user_id, token)`; upserted on app launch.

## 5. Selection logic (pure, testable)

`selectAlertsToNotify(openUnnotifiedAlerts, { mode, channel, enabled }) →
{ toSend: Alert[], wouldSend: boolean }`:
- `enabled = notify_safety_alerts && channel !== 'off' && channel !== 'in_app'`.
  If false → `toSend: []`.
- `mode 'immediate'` → only `severity === 'critical'`.
- `mode 'digest'` → `severity ∈ {critical, warn}` (warn primarily; any critical
  the immediate path missed — e.g. created by the cron's own reconcile for an
  inactive user — is swept here too).
- `info` alerts (the self-check nudges) are NEVER emailed/pushed.
Pure function `selectAlertsToNotify` lives in `packages/peptides/src/alerts.ts`
(alongside `reconcileAlerts`), unit-tested via the existing `pnpm test:alerts`
harness: covers enabled/disabled, each mode, the info-exclusion, and empty.

## 6. Dispatch module (server-only)

`apps/web/lib/notify/dispatch-alerts.ts` →
`dispatchAlertNotifications(userId, mode): Promise<{ emailed: boolean; pushed: number }>`:
1. Load settings (`notify_safety_alerts`, `notification_channel`) + open alerts
   with `notified_at IS NULL`.
2. `selectAlertsToNotify(...)` → `toSend`. If empty, return.
3. **Email** (channel ∈ {email, both}): render the new `safety-alert` template
   (clinician-framed list: title, message, evidence badge, citation; the
   SafetyDisclaimer footer) → `sendEmail`. **Push** (channel === 'both'): build a
   payload (title "RecompIQ safety alert", body = the top alert's title + count,
   deep-link `recompiq://alerts` / `/alerts`) → `sendPush` to the user's
   `push_tokens`.
4. Stamp `notified_at = now()` on `toSend`; write a `notification_sends` row
   (`kind='safety_alert'`) for the day (daily idempotency on the digest path).
Best-effort: an email/push failure logs (via `redactedLogger`) and does NOT block
the request; `notified_at` is stamped only for channels that succeeded enough to
avoid silent loss (stamp after a successful email OR push; if both fail, leave
`notified_at` null so the next run retries).

## 7. Channel semantics (existing enum, no new values)

`notification_channel` + `notify_safety_alerts` (must be true for any send):
- `off` → nothing. `in_app` → in-app surfaces only (already work); no email/push.
- `email` → email only.
- `both` → email **+ push** (push only if a `push_tokens` row exists).
"both" = all external channels. (A granular push-only toggle is a future option.)

## 8. Immediate-critical path

- **Web**: `loadAlerts` (server) already reconciles on dashboard/`/alerts` load.
  After inserting new alerts, it calls `dispatchAlertNotifications(userId,
  'immediate')` inline (server-side; only does real work when a *new critical*
  was just created — rare, so negligible latency).
- **Mobile**: reconciles client-side, so add `POST /api/alerts/dispatch`
  authenticated by the caller's **Supabase JWT as Bearer** (verified server-side
  via `supabase.auth.getUser(token)`). Mobile calls it after its reconcile; the
  route runs `dispatchAlertNotifications(userId, 'immediate')`. This Bearer route
  also establishes the mobile→server-auth pattern (the deferred carryover).

## 9. Daily digest via the cron

Add a `safety_alert` kind to `/api/cron/reminders`. In the existing per-user loop:
reconcile the user's alerts **server-side** (so inactive users' alerts are caught
— important for safety), then `dispatchAlertNotifications(userId, 'digest')`.
Reuses the per-user gate, `notification_sends` dedupe (one digest/user/day), and
batch send. Critical alerts already emailed immediately are skipped (their
`notified_at` is set).

## 10. Push infrastructure

- **Mobile**: `expo-notifications` (+ `expo-device`) — on launch, request
  permission, fetch the Expo push token, upsert into `push_tokens` via
  supabase-js. A small `lib/push.ts` (register + upsert). Gracefully no-ops on
  simulators / denied permission.
- **Server**: `sendPush(tokens, payload)` hitting Expo's push API
  (`https://exp.host/--/api/v2/push/send`) — batched, chunked ≤100, handles the
  `DeviceNotRegistered` receipt by deleting stale tokens. No third-party account.
  Lives at `apps/web/lib/notify/push.ts` (server-only; the cron + routes that
  call it are all in the web app).

## 11. Email + push content

- New `safety-alert` email template (in `@peptide/email`): subject "Safety
  alert(s) to review", a clinician-framed list of the sent alerts (title,
  message, evidence-level badge, citation), and the standard disclaimer footer +
  a "View in RecompIQ" link to `/alerts`. Reuses the existing email component
  palette.
- Push payload: title "RecompIQ safety alert", body = top alert title (+ "and N
  more" when batched), data `{ url: '/alerts' }`.

## 12. Safety

- Content is the engine/catalog's vetted, non-prescribing copy — no new
  dose/instruction text. Email carries the SafetyDisclaimer footer.
- `safety-reviewer` runs on the email template + push copy + dispatch module.
- `schema-guardian` on the migration (`alerts.notified_at`, `push_tokens`) — RLS,
  reversible.
- PII: emails go to the user's own address; push tokens are not PII-laden;
  logging via `redactedLogger` (no raw alert values to stdout).

## 13. Testing + gates

- `pnpm test:alerts` — extended to cover the pure `selectAlertsToNotify`.
- typecheck 16/16 · migration via `node scripts/db-apply.mjs` · `expo export -p ios`.
- **Live e2e**: the demo user already trips a critical (BP 166/99, glucose 264)
  and a warn — trigger the cron route manually (or hit `/api/alerts/dispatch`) to
  confirm an email is sent to the demo address and `notified_at` gets stamped.
- safety-reviewer 0 blockers; schema-guardian 0 blockers.

## 14. Out of scope (v1)

- A granular push-only preference (push rides the `both` channel for now).
- Real-time push for *warn* alerts (warn = daily digest only).
- Per-alert email threading / web push (browser notifications).
- SMS.
- Quiet-hours / per-user send-time tuning beyond the existing daily cron time.
