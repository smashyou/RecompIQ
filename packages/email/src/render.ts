import { createElement } from "react";
import { render } from "@react-email/render";
import { templates, type TemplateName, type TemplatePropsMap } from "./templates";
import type { AuthEmailPlan } from "./auth-hook";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Render a template to inlined HTML + a plain-text fallback. Pure — imports no
 * Resend / secrets — so the preview script and any non-sending context can use
 * it freely. `sendEmail` builds on this.
 */
export async function renderTemplate<K extends TemplateName>(
  name: K,
  props: TemplatePropsMap[K],
): Promise<RenderedEmail> {
  const def = templates[name];
  const element = createElement(def.Component, props);
  const [html, text] = await Promise.all([
    render(element, { pretty: true }),
    render(element, { plainText: true }),
  ]);
  return { subject: def.subject, html, text };
}

/** HTML only (no plain-text pass) — used by the Supabase-paste exporter. */
export async function renderHtml<K extends TemplateName>(
  name: K,
  props: TemplatePropsMap[K],
): Promise<string> {
  const def = templates[name];
  return render(createElement(def.Component, props), { pretty: true });
}

/** Render a resolved auth-hook plan (narrows the union to a typed render). */
export async function renderAuthPlan(plan: AuthEmailPlan): Promise<RenderedEmail> {
  switch (plan.template) {
    case "confirm-signup":
      return renderTemplate("confirm-signup", plan.props);
    case "magic-link":
      return renderTemplate("magic-link", plan.props);
    case "reset-password":
      return renderTemplate("reset-password", plan.props);
    case "email-change":
      return renderTemplate("email-change", plan.props);
  }
}
