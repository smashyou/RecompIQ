// Goal taxonomy (REGIMEN_GOALS_PRD §2). Reference data shared by web + mobile.
// Representative compounds are a DESCRIPTIVE capability mapping graded in-app —
// never a recommendation. Projection capability gates which goals get an
// illustrative projection line in v1 (fat-loss + muscle + skin, per §9).

export const GOAL_KEYS = [
  "fat_loss",
  "muscle_gain",
  "injury_recovery",
  "skin_quality",
  "hair",
  "cognition",
  "longevity",
  "energy",
  "sleep",
  "immune",
  "libido",
  "gut",
  "mood",
] as const;
export type GoalKey = (typeof GOAL_KEYS)[number];

export type ProjectionKind = "weight" | "strength" | "trend" | "recovery" | "composite";

export interface GoalDef {
  key: GoalKey;
  label: string;
  /** One-line "what it tracks". */
  blurb: string;
  /** Representative catalog compound slugs (graded in-app; descriptive only). */
  representativeSlugs: string[];
  /** Signals logged for this goal. */
  signals: string[];
  projection: ProjectionKind;
  /** True = gets an illustrative projection line in v1 (§9). Others are trend-only. */
  hasV1Projection: boolean;
}

export const GOAL_TAXONOMY: GoalDef[] = [
  {
    key: "fat_loss",
    label: "Fat loss / recomposition",
    blurb: "Lose fat while preserving muscle.",
    representativeSlugs: ["retatrutide", "tirzepatide", "semaglutide", "aod-9604", "mots-c"],
    signals: ["weight", "waist", "body-fat %", "photos"],
    projection: "weight",
    hasV1Projection: true,
  },
  {
    key: "muscle_gain",
    label: "Muscle gain / strength",
    blurb: "Build lean mass and strength.",
    representativeSlugs: ["ipamorelin", "cjc-1295", "sermorelin", "mk-677", "tesamorelin"],
    signals: ["lift loads", "lean mass", "limb circumference", "photos"],
    projection: "strength",
    hasV1Projection: true,
  },
  {
    key: "injury_recovery",
    label: "Injury healing / recovery",
    blurb: "Heal tissue and recover faster.",
    representativeSlugs: ["bpc-157", "tb-500", "kpv", "ghk-cu"],
    signals: ["pain 0–10", "mobility/ROM", "milestones", "symptoms"],
    projection: "recovery",
    hasV1Projection: false,
  },
  {
    key: "skin_quality",
    label: "Skin quality / anti-aging",
    blurb: "Improve skin tone, elasticity, hydration.",
    representativeSlugs: ["ghk-cu", "epitalon", "nad-plus", "glutathione"],
    signals: ["skin rating 1–10", "hydration", "face/skin photos"],
    projection: "trend",
    hasV1Projection: true,
  },
  {
    key: "hair",
    label: "Hair restoration",
    blurb: "Density, shedding, hairline.",
    representativeSlugs: ["ghk-cu", "tb-500"],
    signals: ["density rating", "shed count", "hairline/crown photos"],
    projection: "trend",
    hasV1Projection: false,
  },
  {
    key: "cognition",
    label: "Cognition / focus",
    blurb: "Focus, clarity, neuroprotection.",
    representativeSlugs: ["semax", "selank", "dihexa", "bpc-157"],
    signals: ["focus 1–10", "30-sec reaction/memory test", "mood"],
    projection: "trend",
    hasV1Projection: false,
  },
  {
    key: "longevity",
    label: "Longevity / cellular aging",
    blurb: "Cellular aging and overall vitality.",
    representativeSlugs: ["epitalon", "nad-plus", "ss-31", "mots-c", "thymalin"],
    signals: ["energy/sleep/recovery composite", "labs (optional)"],
    projection: "composite",
    hasV1Projection: false,
  },
  {
    key: "energy",
    label: "Energy / mitochondrial",
    blurb: "Daily energy and mitochondrial vitality.",
    representativeSlugs: ["mots-c", "ss-31", "5-amino-1mq", "nad-plus"],
    signals: ["energy 1–10", "RHR/HRV", "steps"],
    projection: "trend",
    hasV1Projection: false,
  },
  {
    key: "sleep",
    label: "Sleep quality",
    blurb: "Duration, latency, awakenings.",
    representativeSlugs: ["dsip", "epitalon"],
    signals: ["sleep duration", "quality", "latency", "awakenings"],
    projection: "trend",
    hasV1Projection: false,
  },
  {
    key: "immune",
    label: "Immune resilience",
    blurb: "Resist illness, recover from it.",
    representativeSlugs: ["thymosin-alpha-1", "thymalin", "ll-37"],
    signals: ["sick-days", "symptom log", "energy"],
    projection: "trend",
    hasV1Projection: false,
  },
  {
    key: "libido",
    label: "Sexual health / libido",
    blurb: "Libido and function.",
    representativeSlugs: ["pt-141", "kisspeptin", "gonadorelin"],
    signals: ["libido/function 1–10"],
    projection: "trend",
    hasV1Projection: false,
  },
  {
    key: "gut",
    label: "Gut health",
    blurb: "GI comfort and regularity.",
    representativeSlugs: ["bpc-157", "kpv", "larazotide"],
    signals: ["GI symptom score", "bloating", "regularity"],
    projection: "trend",
    hasV1Projection: false,
  },
  {
    key: "mood",
    label: "Mood / stress resilience",
    blurb: "Mood and stress tolerance.",
    representativeSlugs: ["selank", "semax", "dsip"],
    signals: ["mood/stress 1–10", "sleep"],
    projection: "trend",
    hasV1Projection: false,
  },
];

export const GOAL_BY_KEY: Record<GoalKey, GoalDef> = Object.fromEntries(
  GOAL_TAXONOMY.map((g) => [g.key, g]),
) as Record<GoalKey, GoalDef>;

export const GOAL_STATUS = ["active", "queued", "done"] as const;
export type GoalStatus = (typeof GOAL_STATUS)[number];
