import { chat } from "./gateway";
import type { GatewayDeps } from "./gateway";
import type { ChatRequest } from "./types/index";
import { stackerPlan, GOAL_BY_KEY, type StackerPlan, type GoalKey } from "@peptide/shared";

export interface StackerCatalogEntry {
  slug: string;
  name: string;
  category: string;
  evidence_level: string;
  fda_approved: boolean;
}

export interface StackerProfile {
  conditions: string[];
  medications: string[];
  injuries: string[];
  age: number | null;
  sex: string | null;
}

export interface GenerateStackOpts {
  goalKeys: GoalKey[];
  freeText?: string | null;
  profile: StackerProfile;
  catalog: StackerCatalogEntry[];
  userId?: string;
}

export interface GenerateStackResult {
  plan: StackerPlan;
  modelUsed: string;
}

const SYSTEM_PROMPT = `You are RecompIQ's goal-driven regimen ASSISTANT. You help a user (or their clinician) assemble an EDUCATIONAL, evidence-graded plan from peptides/compounds. You do NOT prescribe.

HARD RULES:
- You only educate, summarize literature, grade evidence, and flag safety. The user (or their clinician) always decides.
- Use ONLY compound slugs from the provided catalog. Never invent a compound or slug.
- Doses: give a LITERATURE/COMMUNITY RANGE only, as "literature_dose_text" (e.g. "2–4 mg weekly (HUMAN_RCT)"), or null when none is established. Never present a dose as a prescription or a personalized recommendation. Never fabricate a number for research-only peptides — use null.
- Default to a PHASED plan when the user picks several goals or many compounds, or when goals conflict (e.g. aggressive fat-loss vs muscle gain). Explain the phasing in "phasing_rationale". Put warnings (too many compounds, conflicting aims, cost/tracking burden) in "warnings".
- Respect the user's profile: avoid or explicitly caution compounds that conflict with their conditions/medications/injuries, and surface those in each item's "cautions" and in "clinician_points".
- Keep each phase focused. Provide monitoring notes + clinician discussion points.

If "free_text" is provided, infer the user's goals from it and list the matched goal keys in "detected_goal_keys" (from this set only: fat_loss, muscle_gain, injury_recovery, skin_quality, hair, cognition, longevity, energy, sleep, immune, libido, gut, mood).

Return ONLY a JSON object (no prose, no markdown fences) of this exact shape:
{
  "summary": string,
  "detected_goal_keys": string[],
  "phasing_rationale": string,
  "warnings": string[],
  "phases": [
    {
      "name": string,
      "goal_keys": string[],
      "rationale": string,
      "items": [
        {
          "slug": string,
          "name": string,
          "why": string,
          "evidence_level": string,
          "literature_dose_text": string | null,
          "monitoring": string[],
          "cautions": string[]
        }
      ]
    }
  ],
  "clinician_points": string[]
}`;

export async function generateStack(
  opts: GenerateStackOpts,
  deps: GatewayDeps,
): Promise<GenerateStackResult> {
  const goalLabels = opts.goalKeys.map((k) => GOAL_BY_KEY[k]?.label).filter(Boolean);
  const catalogList = opts.catalog
    .map(
      (c) =>
        `${c.slug} — ${c.name} (${c.category}; ${c.evidence_level}${c.fda_approved ? "; FDA-approved" : ""})`,
    )
    .join("\n");

  const p = opts.profile;
  const userMsg = [
    `Selected goals: ${goalLabels.length ? goalLabels.join(", ") : "(none — infer from free text)"}`,
    `Free text: ${opts.freeText?.trim() || "(none)"}`,
    "",
    "User profile:",
    `- conditions: ${p.conditions.length ? p.conditions.join(", ") : "none reported"}`,
    `- medications: ${p.medications.length ? p.medications.join(", ") : "none reported"}`,
    `- injuries: ${p.injuries.length ? p.injuries.join(", ") : "none reported"}`,
    `- age: ${p.age ?? "unknown"}; sex: ${p.sex ?? "unknown"}`,
    "",
    "Catalog (use ONLY these slugs):",
    catalogList,
    "",
    "Return ONLY the JSON object described in the system prompt.",
  ].join("\n");

  const req: ChatRequest = {
    feature: "coach",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    max_tokens: 4000,
    temperature: 0.4,
    userId: opts.userId,
  };

  const response = await chat(req, deps);
  const cleaned = response.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Stacker response was not valid JSON: ${cleaned.slice(0, 200)}`);
  }

  const validated = stackerPlan.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Stacker response failed schema validation: ${validated.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 3)
        .join("; ")}`,
    );
  }

  // Drop any item whose slug isn't in the catalog (model hallucination guard).
  const validSlugs = new Set(opts.catalog.map((c) => c.slug));
  const plan: StackerPlan = {
    ...validated.data,
    phases: validated.data.phases.map((phase) => ({
      ...phase,
      items: phase.items.filter((it) => validSlugs.has(it.slug)),
    })),
  };

  return { plan, modelUsed: response.model };
}
