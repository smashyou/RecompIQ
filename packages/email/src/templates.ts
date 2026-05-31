import type { ComponentType } from "react";

import ConfirmSignup, { subject as confirmSignupSubject } from "./emails/auth/confirm-signup";
import MagicLink, { subject as magicLinkSubject } from "./emails/auth/magic-link";
import ResetPassword, { subject as resetPasswordSubject } from "./emails/auth/reset-password";
import EmailChange, { subject as emailChangeSubject } from "./emails/auth/email-change";

import Welcome, { subject as welcomeSubject } from "./emails/lifecycle/welcome";
import WeeklySummary, { subject as weeklySummarySubject } from "./emails/lifecycle/weekly-summary";
import BodyShotReminder, { subject as bodyShotSubject } from "./emails/lifecycle/body-shot-reminder";
import DoseWeighInReminder, { subject as doseSubject } from "./emails/lifecycle/dose-weigh-in-reminder";
import AccountDeletion, { subject as deletionSubject } from "./emails/lifecycle/account-deletion";
import DataExportReady, { subject as exportSubject } from "./emails/lifecycle/data-export-ready";

import type {
  ConfirmSignupProps,
  MagicLinkProps,
  ResetPasswordProps,
  EmailChangeProps,
  WelcomeProps,
  WeeklySummaryProps,
  BodyShotReminderProps,
  DoseWeighInReminderProps,
  AccountDeletionProps,
  DataExportReadyProps,
} from "./types";

/** Channel: Group A is sent by Supabase; Group B is sent by our app via Resend. */
export type EmailGroup = "auth" | "lifecycle";

/** The single source of truth mapping each template name to its prop type. */
export interface TemplatePropsMap {
  "confirm-signup": ConfirmSignupProps;
  "magic-link": MagicLinkProps;
  "reset-password": ResetPasswordProps;
  "email-change": EmailChangeProps;
  welcome: WelcomeProps;
  "weekly-summary": WeeklySummaryProps;
  "body-shot-reminder": BodyShotReminderProps;
  "dose-weigh-in-reminder": DoseWeighInReminderProps;
  "account-deletion": AccountDeletionProps;
  "data-export-ready": DataExportReadyProps;
}

export type TemplateName = keyof TemplatePropsMap;

interface TemplateDef<K extends TemplateName> {
  group: EmailGroup;
  /** Default subject. Group A subjects are informational (set in Supabase). */
  subject: string;
  Component: ComponentType<TemplatePropsMap[K]>;
}

type Registry = { [K in TemplateName]: TemplateDef<K> };

export const templates: Registry = {
  // ---- Group A: Supabase auth (sent by Supabase, not our code) ----
  "confirm-signup": { group: "auth", subject: confirmSignupSubject, Component: ConfirmSignup },
  "magic-link": { group: "auth", subject: magicLinkSubject, Component: MagicLink },
  "reset-password": { group: "auth", subject: resetPasswordSubject, Component: ResetPassword },
  "email-change": { group: "auth", subject: emailChangeSubject, Component: EmailChange },

  // ---- Group B: lifecycle / transactional (sent by our app via Resend) ----
  welcome: { group: "lifecycle", subject: welcomeSubject, Component: Welcome },
  "weekly-summary": { group: "lifecycle", subject: weeklySummarySubject, Component: WeeklySummary },
  "body-shot-reminder": { group: "lifecycle", subject: bodyShotSubject, Component: BodyShotReminder },
  "dose-weigh-in-reminder": { group: "lifecycle", subject: doseSubject, Component: DoseWeighInReminder },
  "account-deletion": { group: "lifecycle", subject: deletionSubject, Component: AccountDeletion },
  "data-export-ready": { group: "lifecycle", subject: exportSubject, Component: DataExportReady },
};

export const TEMPLATE_NAMES = Object.keys(templates) as TemplateName[];

export function isLifecycle(name: TemplateName): boolean {
  return templates[name].group === "lifecycle";
}
