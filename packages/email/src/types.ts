/**
 * Prop types for every email template.
 *
 * GROUP A (auth) — rendered with Supabase Go-template placeholders baked in.
 * Each field defaults to its `{{ .X }}` placeholder so the canonical render is
 * paste-ready for the Supabase dashboard; pass real values only for previews.
 *
 * GROUP B (lifecycle) — sent by our app via Resend with real per-user data.
 */

// ---- Group A: Supabase auth -------------------------------------------------

export interface ConfirmSignupProps {
  confirmationUrl?: string; // {{ .ConfirmationURL }}
}

export interface MagicLinkProps {
  confirmationUrl?: string; // {{ .ConfirmationURL }}
  token?: string; // {{ .Token }}
}

export interface ResetPasswordProps {
  confirmationUrl?: string; // {{ .ConfirmationURL }}
}

export interface EmailChangeProps {
  confirmationUrl?: string; // {{ .ConfirmationURL }}
  email?: string; // {{ .Email }} — current address
  newEmail?: string; // {{ .NewEmail }} — requested address
}

// ---- Group B: lifecycle / transactional ------------------------------------

/** Common to all Group B emails. */
export interface LifecycleBase {
  firstName?: string;
  /** Per-user unsubscribe link; falls back to /settings/notifications. */
  unsubscribeUrl?: string;
}

export interface WelcomeProps extends LifecycleBase {
  dashboardUrl?: string;
}

export interface WeeklySummaryProps extends LifecycleBase {
  /** e.g. "May 19 – May 25". */
  weekRange: string;
  /** Signed weight delta string, e.g. "−2.4" (uses U+2212 for minus). */
  weightChange: string;
  weightChangeUnit?: string; // "lb"
  /** Direction of the change for color encoding (loss is positive here). */
  weightTrend?: "down" | "up" | "flat";
  currentWeight: string;
  proteinAvg: string;
  proteinTarget?: string;
  doseAdherencePct: number;
  daysLogged: number;
  dashboardUrl?: string;
}

export interface BodyShotReminderProps extends LifecycleBase {
  daysSinceLast: number;
  captureUrl?: string;
}

export interface DueItem {
  label: string; // "Retatrutide + AOD-9604"
  detail?: string; // "Morning dose"
}

export interface DoseWeighInReminderProps extends LifecycleBase {
  /** Things due today — doses and/or a weigh-in. */
  items: DueItem[];
  includeWeighIn?: boolean;
  logUrl?: string;
}

export interface AccountDeletionProps extends LifecycleBase {
  /** When the deletion completes / completed (human string). Optional. */
  effectiveDate?: string;
  /** If a final export was attached/available. */
  exportUrl?: string;
}

export interface DataExportReadyProps extends LifecycleBase {
  downloadUrl: string;
  /** Human-readable expiry, e.g. "June 7, 2026". */
  expiresAt: string;
  formats?: string; // "JSON + CSV"
}
