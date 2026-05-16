// Contraindication matching. Given a user's health snapshot + a compound,
// surface any contraindications (absolute = block; relative = warn).
//
// String matching is intentionally loose (case-insensitive substring) because
// users type free-form condition / medication names. False positives are
// preferable to false negatives for a safety-critical surface.

export type ContraSeverity = "absolute" | "relative";

export interface UserHealthSnapshot {
  conditions: string[];
  medications: string[];
  age: number | null;
  sex?: string | null;
  pregnant?: boolean;
}

export interface CompoundContraData {
  slug: string;
  name: string;
  absolute_contraindications: string[];
  relative_contraindications: string[];
}

export interface ContraindicationFinding {
  compoundSlug: string;
  compoundName: string;
  severity: ContraSeverity;
  reason: string;
  matchedAgainst: string; // e.g. "your medication: Metformin"
}

// Light keyword extraction: pull alphanumeric tokens of len >= 4 from a contra rule,
// so a rule like "Personal or family history of medullary thyroid carcinoma"
// matches a user condition string containing "thyroid".
function keywordsFrom(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4)
    .filter((t) => !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "personal","family","history","active","syndrome","disease","disorder","prior",
  "with","past","severe","mild","moderate","status","known","under","over","high","low",
  "type","stage","level","very","without","grade","insufficient","data","route","care",
  "long","term","term","control","also","being","range","please","please","patients",
  "patient","etc","such","this","that","there","their","when","then","into","upon",
]);

function matchAgainst(rule: string, candidates: string[]): string | null {
  const ruleLower = rule.toLowerCase();
  for (const cand of candidates) {
    if (!cand) continue;
    const candLower = cand.toLowerCase();
    if (ruleLower.includes(candLower) || candLower.includes(ruleLower)) {
      return cand;
    }
    const rk = keywordsFrom(rule);
    const ck = new Set(keywordsFrom(cand));
    for (const k of rk) {
      if (ck.has(k)) return cand;
    }
  }
  return null;
}

export function evaluateContraindications(
  compound: CompoundContraData,
  snapshot: UserHealthSnapshot,
): ContraindicationFinding[] {
  const findings: ContraindicationFinding[] = [];
  const haystack = [...snapshot.conditions, ...snapshot.medications];

  if (snapshot.pregnant) {
    const pregRule =
      compound.absolute_contraindications.find((r) => /pregnan/i.test(r)) ||
      compound.relative_contraindications.find((r) => /pregnan/i.test(r));
    if (pregRule) {
      findings.push({
        compoundSlug: compound.slug,
        compoundName: compound.name,
        severity: compound.absolute_contraindications.includes(pregRule)
          ? "absolute"
          : "relative",
        reason: pregRule,
        matchedAgainst: "pregnancy",
      });
    }
  }

  for (const rule of compound.absolute_contraindications) {
    const m = matchAgainst(rule, haystack);
    if (m) {
      findings.push({
        compoundSlug: compound.slug,
        compoundName: compound.name,
        severity: "absolute",
        reason: rule,
        matchedAgainst: m,
      });
    }
  }
  for (const rule of compound.relative_contraindications) {
    const m = matchAgainst(rule, haystack);
    if (m) {
      findings.push({
        compoundSlug: compound.slug,
        compoundName: compound.name,
        severity: "relative",
        reason: rule,
        matchedAgainst: m,
      });
    }
  }

  // Dedupe (a single condition can hit both abs + rel rules; keep absolute)
  const seen = new Map<string, ContraindicationFinding>();
  for (const f of findings) {
    const key = `${f.severity}::${f.reason}`;
    if (!seen.has(key)) seen.set(key, f);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "absolute" ? -1 : 1,
  );
}
