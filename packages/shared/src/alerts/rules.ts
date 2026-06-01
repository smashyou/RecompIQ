import type { AlertRule } from "./types";

// Thresholds + citations below are EVIDENCE-RESEARCHED and finalized (one
// citation + EvidenceLevel per kind) so the UI can show an EvidenceBadge. Cut
// points are sourced to clinical guidance where one exists; self-report kinds
// note their proxy/unvalidated nature honestly. Every message is an
// OBSERVATION + "discuss with your clinician" framing — never an instruction,
// dose, or "take/stop X". {v} interpolates the salient value at render time.
export const ALERT_RULES: Record<string, AlertRule> = {
  rapid_weight_loss: {
    kind: "rapid_weight_loss", direction: "high", warnAt: 2, criticalAt: 3,
    evidenceLevel: "HUMAN_RCT", citation: "Obesity-medicine safe-rate 1–2 lb/wk; gallstone risk >3 lb/wk (Festi et al. PMC3921672); GLP-1 sarcopenia concern",
    title: "Rapid weight loss",
    messageWarn: "Your logged weight is dropping faster than ~{v} lb/week — worth confirming with your clinician that your protein and training are protecting muscle.",
    messageCritical: "Your logged weight is dropping faster than ~{v} lb/week. A pace this fast can raise gallstone and muscle-loss concerns — worth discussing with your clinician how to keep protein and training protecting your muscle.",
  },
  low_protein: {
    // No external numeric cut — the engine compares the user's average intake to
    // their OWN protein goal min (fires when avg < ~70% of goal min for the recent
    // window). warnAt is a structural placeholder only.
    kind: "low_protein", direction: "low", warnAt: 1,
    evidenceLevel: "HUMAN_OBS", citation: "No absolute clinical floor; RDA 0.8 g/kg/day is a population minimum, not an alert cut — relative to the user's own target",
    title: "Protein below your target",
    messageWarn: "Your recent average is about {v} g/day, under the protein target in your plan — keeping protein up helps protect muscle. Worth raising with your clinician or dietitian.",
  },
  severe_nausea: {
    kind: "severe_nausea", direction: "high", warnAt: 6, criticalAt: 8,
    evidenceLevel: "HUMAN_OBS", citation: "NCI CTCAE v5.0 nausea/vomiting grading; GLP-1 GI expert consensus (PMC9821052)",
    title: "Nausea",
    messageWarn: "You rated your nausea {v}/10 recently, which is on the higher side — worth mentioning to your clinician, especially if it's affecting eating or fluids.",
    messageCritical: "You rated your nausea {v}/10. Seek care if you can't keep fluids down, are vomiting repeatedly, or feel faint; otherwise contact your clinician about this.",
  },
  dehydration: {
    // Composite signal (low fluids + GI symptoms) — no single numeric cut.
    kind: "dehydration",
    evidenceLevel: "FDA_APPROVED", citation: "FDA GLP-1 class label update 2025: GI losses → dehydration → AKI; monitor renal function",
    title: "Possible dehydration",
    messageWarn: "Your recent fluid logging is low alongside some nausea, a combination that can point toward dehydration — worth discussing with your clinician, particularly given the GI effects of these compounds.",
  },
  glucose_high: {
    kind: "glucose_high", direction: "high", warnAt: 250, criticalAt: 300,
    evidenceLevel: "FDA_APPROVED", citation: "ADA Standards of Care 2025, Sec. 6 + ADA Sick-Day Guide (>250 ketone-check, >300 ER)",
    title: "High blood glucose",
    messageWarn: "Your reading of {v} mg/dL is above 250 — bring it up with your clinician.",
    messageCritical: "A reading of {v} mg/dL is high enough that clinicians advise sick-day precautions; contact your clinician.",
  },
  glucose_low: {
    kind: "glucose_low", direction: "low", warnAt: 70, criticalAt: 54,
    evidenceLevel: "FDA_APPROVED", citation: "ADA Standards of Care 2025, Sec. 6 (hypoglycemia: <70 Level 1, <54 Level 2)",
    title: "Low blood glucose",
    messageWarn: "A reading of {v} mg/dL is below 70, which clinicians call low blood sugar — worth discussing with your clinician.",
    messageCritical: "A reading of {v} mg/dL is in the range of severe hypoglycemia. If you feel confused, shaky, or faint, treat per your clinician's hypoglycemia plan and seek help.",
  },
  bp_high: {
    kind: "bp_high", direction: "high", warnAt: 140, criticalAt: 180,
    evidenceLevel: "FDA_APPROVED", citation: "ACC/AHA 2017 BP guideline (thresholds unchanged in 2025)",
    title: "Elevated blood pressure",
    messageWarn: "Your last reading {v} is at or above 140/90 — keep discussing your blood pressure with your clinician.",
    messageCritical: "A blood pressure of {v} is in the range of severe hypertension. If you have symptoms like chest pain, vision change, or trouble speaking, this can be a hypertensive emergency — seek care now; otherwise contact your clinician promptly.",
  },
  bp_low: {
    kind: "bp_low", direction: "low", warnAt: 90, criticalAt: 80,
    evidenceLevel: "HUMAN_OBS", citation: "Standard clinical hypotension (SBP <90); American Autonomic Society orthostatic-hypotension consensus",
    title: "Low blood pressure",
    messageWarn: "Your last reading {v} is on the low side — if you feel dizzy, lightheaded, or faint when standing, mention it to your clinician.",
    messageCritical: "Your last reading {v} is quite low — if you feel dizzy, faint, or confused, seek care; otherwise contact your clinician promptly.",
  },
  neuro_worsening: {
    kind: "neuro_worsening", direction: "high", warnAt: 6, criticalAt: 8,
    evidenceLevel: "ANECDOTAL", citation: "Self-report proxy: warn = ~2-point rise from baseline (NRS MCID convention); critical = new functional deficit. Clinical signal grounded in ADA neuropathy guidance, but the exact self-report cut is unvalidated",
    title: "Nerve symptoms",
    messageWarn: "Your logged nerve symptoms have increased — this is worth discussing with your clinician given your history.",
    messageCritical: "Your logged nerve symptoms have increased noticeably. New or rapidly worsening numbness, weakness, or loss of function should be evaluated; please contact your clinician, and seek care for sudden severe weakness.",
  },
  side_effect_cluster: {
    kind: "side_effect_cluster", direction: "high", warnAt: 3, criticalAt: 5,
    evidenceLevel: "ANECDOTAL", citation: "No clinical guideline; conservative concurrent-AE-count heuristic — prompts clinician discussion, not a diagnosis",
    title: "Several side effects at once",
    messageWarn: "A few side-effect signals are showing up together in your recent logs — that pattern is worth reviewing with your clinician to make sure nothing is being missed.",
    messageCritical: "Several side-effect signals are showing up together in your recent logs — that pattern is worth reviewing with your clinician soon to make sure nothing is being missed.",
  },
  unsafe_stack: {
    // No numeric — severity comes from the contraindication evaluator.
    kind: "unsafe_stack",
    evidenceLevel: "HUMAN_OBS", citation: "Driven by the compound contraindication catalog; per-pair evidence varies (e.g. MTC black-box = FDA_APPROVED)",
    title: "Possible contraindication",
    messageWarn: "One of your active compounds may have a contraindication with something in your health profile — please review this with your clinician before continuing.",
    messageCritical: "One of your active compounds may have a serious contraindication with something in your health profile. Please review this with your clinician before continuing.",
  },
  adherence_drop: {
    kind: "adherence_drop", direction: "low", warnAt: 80, criticalAt: 60,
    evidenceLevel: "ANECDOTAL", citation: "No clinical cut; PQA PDC ≥80% chronic-med adherence standard, applied by analogy",
    title: "Adherence has dropped",
    messageWarn: "About {v}% of your recent scheduled doses were logged as taken, a bit lower than before — if you're intentionally changing your routine, it's worth noting that for your clinician.",
    messageCritical: "Only about {v}% of your recent scheduled doses were logged as taken — if life has gotten in the way, no judgment; it's just worth mentioning to your clinician so your plan reflects what you're actually doing.",
  },
};
