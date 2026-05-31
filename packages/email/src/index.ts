/**
 * @peptide/email — RecompIQ branded email system.
 *
 * The package root is the PURE surface (render + registry + types + tokens).
 * It intentionally does NOT export `sendEmail` — import `@peptide/email/send`
 * for that, so importing the root never pulls in the Resend SDK or secrets.
 */
export { renderTemplate, renderHtml, renderAuthPlan, type RenderedEmail } from "./render";
export {
  planAuthEmail,
  recipientFor,
  type AuthEmailPlan,
  type SupabaseSendEmailPayload,
  type SupabaseEmailData,
  type SupabaseEmailActionType,
} from "./auth-hook";
export {
  templates,
  TEMPLATE_NAMES,
  isLifecycle,
  type EmailGroup,
  type TemplateName,
  type TemplatePropsMap,
} from "./templates";
export * from "./types";
export { palette, radius, space, fonts, type Palette } from "./palette";
export * as emailConfig from "./config";
