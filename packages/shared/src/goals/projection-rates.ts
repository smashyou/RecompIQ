// Literature-derived, GRADED expected-improvement rates that parameterize the
// illustrative per-goal projection lines (REGIMEN_GOALS_PRD §6/§9). Sourced via
// evidence-researcher + held to the non-prescribing boundary: every line is
// ILLUSTRATIVE, not a predicted outcome, and is surfaced with its evidence grade
// + caveat + a clinician prompt. Fat-loss uses the dedicated weight engine, not
// this table. Goals NOT listed here are trend-only until their literature is graded.
//
// `perWeek` is the TARGET expected magnitude/week (positive); the projector
// derives conservative (0.6×) / aggressive (1.15×) bands around it. Rates are
// capped at `horizonWeeks` (the plateau/end-of-data point) — we never project
// past where evidence exists.

export interface ProjectionRate {
  /** The goal_metrics / weights metric key this rate applies to. */
  metricKey: string;
  perWeek: number;
  evidenceLevel: "FDA_APPROVED" | "HUMAN_RCT" | "HUMAN_OBS" | "ANIMAL" | "MECHANISTIC" | "ANECDOTAL";
  horizonWeeks: number;
  citation: string;
  caveat: string;
}

export const PROJECTION_RATES: Record<string, ProjectionRate> = {
  // Skin quality (1–10 self-rating) — GHK-Cu topical, 12-wk placebo-controlled trials.
  skin_quality: {
    metricKey: "skin_quality",
    perWeek: 0.15,
    evidenceLevel: "HUMAN_OBS",
    horizonWeeks: 12,
    citation: "GHK-Cu topical: 12-wk placebo-controlled human trials (Pickart & Margolina 2015, Biomolecules)",
    caveat:
      "Human trials measure clinician/instrument endpoints, not a 1–10 self-rating; the mapping is illustrative. Improvement is shown over ~2–12 weeks and flattens after; injectable GHK-Cu has no controlled human data.",
  },

  // Muscle / lean mass (lb) — GH secretagogues + resistance training.
  lean_mass_lb: {
    metricKey: "lean_mass_lb",
    perWeek: 0.5,
    evidenceLevel: "HUMAN_RCT",
    horizonWeeks: 16,
    citation: "GH-secretagogue RCTs (Nass 2008 MK-677; Khorram 1997 sermorelin) + resistance-training baseline (Moustafa 2020)",
    caveat:
      "Most lean-mass gain reflects resistance training, not the peptide; the secretagogue increment is small/uncertain and unproven for ipamorelin/CJC-1295. MK-677's early gain is partly fluid, and lean mass ≠ strength.",
  },
};

export function projectionRateFor(metricKey: string): ProjectionRate | null {
  return PROJECTION_RATES[metricKey] ?? null;
}
