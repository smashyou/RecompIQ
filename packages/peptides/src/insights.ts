/**
 * Daily-insight safety guard.
 *
 * A dashboard insight is the only place RecompIQ *volunteers* a statement about
 * the user's health — the coach is user-initiated, this is not. That asymmetry
 * sets the posture: the coach WRAPS dose-like text in [edu] tags and lets it
 * through (see `wrapDoseLike`), whereas an unsolicited insight that names a dose
 * or a compound the user never logged is indistinguishable from a prescription.
 * So this guard BLOCKS rather than annotates.
 *
 * It is deliberately a pure function over the generated draft: the insight
 * generator runs off-platform (VPS Claude Code CLI, see
 * `scripts/vps/recompiq-insights-generate.py`), so the guard has to live on the
 * write path in the app — the only chokepoint every backend shares. Swapping the
 * generator to a metered provider cannot route around it.
 *
 * Tested by `pnpm test:insight-guard`.
 */

/** A generated insight before it is persisted. */
export interface InsightDraft {
  headline: string;
  body: string;
  observations: { signal: string; detail: string }[];
  clinicianPrompt: string | null;
}

export interface InsightGuardContext {
  /**
   * Compound names/slugs the user has actually logged (regimen items, doses,
   * purchases). Mentioning anything outside this set is a suggestion to start
   * something new, which is prescribing.
   */
  knownCompounds: string[];
  /**
   * Every compound name/slug in the catalog. The guard can only recognise a
   * "new compound" mention if it knows the vocabulary to look for.
   */
  catalogCompounds: string[];
}

export interface InsightViolation {
  rule:
    | "dose_stated"
    | "unknown_compound"
    | "prescribing_verb"
    | "diagnostic_language"
    | "missing_clinician_prompt"
    | "too_long"
    | "empty";
  detail: string;
}

export const INSIGHT_LIMITS = {
  headlineMaxChars: 120,
  bodyMaxChars: 600,
  maxObservations: 5,
} as const;

/**
 * Numeric quantity + a dose-bearing unit. Same unit set as `DOSE_PATTERN` in
 * safety.ts, kept separate because this one has to distinguish a DOSE from a
 * LAB CONCENTRATION, which that one never needed to.
 */
const QUANTITY = /(\d+(?:\.\d+)?(?:\s*[–—-]\s*\d+(?:\.\d+)?)?)\s?(mg|mcg|μg|iu|units|ml|cc)\b/gi;

/**
 * A denominator that makes the quantity a CONCENTRATION, not a dose:
 * "hs-CRP 2.4 mg/L", "glucose 124 mg/dL", "testosterone 550 ng/dL".
 * Reporting a lab value back to the user is the product working as intended —
 * "alert on numbers, not guesses" — so these are allowed through.
 *
 * Note this must NOT swallow dose frequencies: "300 mcg/day" and "2 mg/wk" are
 * doses. `/dL` vs `/day` is the whole distinction, hence the explicit list
 * rather than a generic `/\w+`.
 */
const CONCENTRATION_DENOMINATOR = /^\/\s*(dL|dl|L|l|mL|ml|g|kg|mmol|m2|m²)\b/;

/**
 * A directive is a verb in an instruction POSITION, not merely a verb. This
 * domain is full of these words used as nouns and narration — "at every
 * scheduled dose", "your current cycle", "adherence started strong" — so
 * matching the verb alone rejects almost every honest insight. The position
 * prefix (sentence start, or "you should" / "consider" / "try") is what makes
 * it an instruction.
 */
const DIRECTIVE_VERB =
  "(?:start|begin|initiat|add|increas|rais|decreas|lower|reduc|titrat|taper|stack|cycl|inject|administer|discontinu|stop|switch|dos)(?:e|es|ed|ing)?";
const PRESCRIBING_DIRECTIVE = new RegExp(
  `(?:^|\\byou (?:should|could|can|might|may|need to|want to|ought to)\\s+|\\bconsider\\s+|\\btry\\s+|\\btime to\\s+|\\blet'?s\\s+)${DIRECTIVE_VERB}\\b`,
  "i",
);

const DIAGNOSTIC_PHRASE =
  /\b(diagnos\w*|you have (?:a |an )?(?:condition|disease|disorder|syndrome|deficiency)|is a sign of|indicates? (?:that )?you)\b/i;

/** Keywords that make an insight clinical enough to require the clinician line. */
const CLINICAL_TOPIC =
  /\b(lab|labs|a1c|glucose|blood pressure|bp|cholesterol|ldl|hdl|triglyceride|crp|testosterone|thyroid|tsh|liver|alt|ast|kidney|creatinine|ferritin|vitamin d|b12|heart rate|nausea|numbness|tingling|neuropathy|dizz\w*|symptom)\b/i;

/** Split on sentence terminators, keeping it simple and dependency-free. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Dose-like quantities, excluding lab concentrations.
 * Returns the matched substrings so a violation can name what tripped it.
 */
export function findStatedDoses(text: string): string[] {
  const hits: string[] = [];
  QUANTITY.lastIndex = 0;
  for (let m = QUANTITY.exec(text); m !== null; m = QUANTITY.exec(text)) {
    const rest = text.slice(m.index + m[0].length);
    if (CONCENTRATION_DENOMINATOR.test(rest)) continue;
    hits.push(m[0]);
  }
  return hits;
}

/** Whole-word, case-insensitive presence of a compound name in text. */
function mentions(text: string, compound: string): boolean {
  const name = compound.trim();
  if (name.length < 3) return false;
  // Slugs and names both appear in prose; treat "-" and " " as equivalent and
  // escape everything else so a name like "GHK-Cu" can't act as a regex.
  const pattern = name
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[\s-]+/g, "[\\s-]+");
  return new RegExp(`(^|[^\\w-])${pattern}([^\\w-]|$)`, "i").test(text);
}

/**
 * Compounds named in the text that the user has not logged. Matching is done
 * against the catalog so an unrelated English word can never be read as a
 * compound, and longest-first so "BPC-157" is not reported twice via "BPC".
 */
export function findUnknownCompounds(text: string, ctx: InsightGuardContext): string[] {
  const known = new Set(ctx.knownCompounds.map((c) => c.trim().toLowerCase()));
  const found: string[] = [];
  const sorted = [...ctx.catalogCompounds].sort((a, b) => b.length - a.length);
  for (const compound of sorted) {
    const key = compound.trim().toLowerCase();
    if (known.has(key)) continue;
    if (found.some((f) => f.toLowerCase().includes(key))) continue;
    if (mentions(text, compound)) found.push(compound);
  }
  return found;
}

/**
 * Run every rule. Returns all violations rather than throwing on the first, so
 * a rejected draft can be logged with the full reason set — a generator that
 * trips the same rule daily is a prompt bug, and you can only see that if the
 * rule is recorded.
 */
export function checkInsight(
  draft: InsightDraft,
  ctx: InsightGuardContext,
): { ok: boolean; violations: InsightViolation[] } {
  const violations: InsightViolation[] = [];
  const headline = draft.headline?.trim() ?? "";
  const body = draft.body?.trim() ?? "";
  const prompt = draft.clinicianPrompt?.trim() ?? "";
  const observationText = draft.observations.map((o) => `${o.signal}: ${o.detail}`).join(". ");
  // Joined with a terminator so `sentences()` can't weld the end of one field
  // onto the start of the next and read the pair as a single directive.
  const all = [headline, body, prompt, observationText].filter(Boolean).join(". ");

  if (!headline || !body) {
    violations.push({ rule: "empty", detail: "headline and body are both required" });
  }

  if (headline.length > INSIGHT_LIMITS.headlineMaxChars) {
    violations.push({
      rule: "too_long",
      detail: `headline ${headline.length} chars (max ${INSIGHT_LIMITS.headlineMaxChars})`,
    });
  }
  if (body.length > INSIGHT_LIMITS.bodyMaxChars) {
    violations.push({
      rule: "too_long",
      detail: `body ${body.length} chars (max ${INSIGHT_LIMITS.bodyMaxChars})`,
    });
  }
  if (draft.observations.length > INSIGHT_LIMITS.maxObservations) {
    violations.push({
      rule: "too_long",
      detail: `${draft.observations.length} observations (max ${INSIGHT_LIMITS.maxObservations})`,
    });
  }

  const doses = findStatedDoses(all);
  if (doses.length > 0) {
    violations.push({
      rule: "dose_stated",
      detail: `states a dose: ${doses.slice(0, 3).join(", ")}`,
    });
  }

  const unknown = findUnknownCompounds(all, ctx);
  if (unknown.length > 0) {
    violations.push({
      rule: "unknown_compound",
      detail: `names compounds the user has not logged: ${unknown.slice(0, 3).join(", ")}`,
    });
  }

  // A prescribing verb only matters next to a compound. "Increase your protein"
  // is nutrition guidance the product is built to give; "increase your BPC-157"
  // is a prescription.
  for (const sentence of sentences(all)) {
    if (!PRESCRIBING_DIRECTIVE.test(sentence)) continue;
    const named = ctx.knownCompounds.filter((c) => mentions(sentence, c));
    if (named.length > 0) {
      violations.push({
        rule: "prescribing_verb",
        detail: `directive about ${named[0]}: "${sentence.slice(0, 90)}"`,
      });
      break;
    }
  }

  if (DIAGNOSTIC_PHRASE.test(all)) {
    violations.push({
      rule: "diagnostic_language",
      detail: "reads as a diagnosis rather than an observation",
    });
  }

  if (CLINICAL_TOPIC.test(all) && !prompt) {
    violations.push({
      rule: "missing_clinician_prompt",
      detail: "touches a clinical signal without a clinician_prompt",
    });
  }

  return { ok: violations.length === 0, violations };
}
