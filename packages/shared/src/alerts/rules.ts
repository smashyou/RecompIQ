import type { AlertRule } from "./types";

// NOTE: thresholds + citations are PLACEHOLDER starting values finalized by the
// evidence-researcher pass (plan Task 3). Each carries an EvidenceLevel + citation
// so the UI can show an EvidenceBadge. Every message is an OBSERVATION + clinician
// framing — never an instruction, dose, or "take/stop X". {v} interpolates the
// salient value at render time.
export const ALERT_RULES: Record<string, AlertRule> = {
  rapid_weight_loss: {
    kind: "rapid_weight_loss", direction: "high", warnAt: 2, criticalAt: 3.5,
    evidenceLevel: "HUMAN_OBS", citation: "Conservative default — sustained loss >1% body weight/week is commonly cited as faster than recommended",
    title: "Rapid weight loss",
    messageWarn: "Your recent trend works out to about {v} lb/week, which is faster than the gradual pace most clinicians aim for — a good thing to review with your clinician.",
    messageCritical: "Your recent trend is about {v} lb/week, well above a gradual pace. Rapid loss can affect muscle, electrolytes, and gallbladder health; please discuss this pace with your clinician.",
  },
  low_protein: {
    // No external numeric cut — the engine compares the user's average intake to
    // their OWN protein goal min. warnAt is a structural placeholder only.
    kind: "low_protein", direction: "low", warnAt: 1,
    evidenceLevel: "HUMAN_RCT", citation: "Higher-protein intake supports lean-mass retention during weight loss (general guidance, not a fixed cut)",
    title: "Protein below your target",
    messageWarn: "Your recent average is about {v} g/day, under the protein target in your plan — keeping protein up helps protect muscle. Worth raising with your clinician or dietitian.",
  },
  severe_nausea: {
    kind: "severe_nausea", direction: "high", warnAt: 6, criticalAt: 8,
    evidenceLevel: "FDA_APPROVED", citation: "GLP-1 / tirzepatide labels (nausea is a common adverse effect; persistent/severe warrants medical review)",
    title: "Nausea",
    messageWarn: "You rated your nausea {v}/10 recently, which is on the higher side — worth mentioning to your clinician, especially if it's affecting eating or fluids.",
    messageCritical: "You rated your nausea {v}/10. Seek care if you can't keep fluids down, are vomiting repeatedly, or feel faint; otherwise contact your clinician about this.",
  },
  dehydration: {
    // Composite signal (low fluids + GI symptoms) — no single numeric cut.
    kind: "dehydration",
    evidenceLevel: "FDA_APPROVED", citation: "GLP-1 / tirzepatide labels (GI effects can cause volume depletion / dehydration and rare AKI)",
    title: "Possible dehydration",
    messageWarn: "Your recent fluid logging is low alongside some nausea, a combination that can point toward dehydration — worth discussing with your clinician, particularly given the GI effects of these compounds.",
  },
  glucose_high: {
    kind: "glucose_high", direction: "high", warnAt: 180, criticalAt: 250,
    evidenceLevel: "FDA_APPROVED", citation: "ADA Standards of Care (hyperglycemia / sick-day)",
    title: "High blood glucose",
    messageWarn: "Your reading of {v} mg/dL is above 180 — bring it up with your clinician.",
    messageCritical: "A reading of {v} mg/dL is high enough that clinicians advise sick-day precautions; contact your clinician.",
  },
  glucose_low: {
    kind: "glucose_low", direction: "low", warnAt: 70, criticalAt: 54,
    evidenceLevel: "FDA_APPROVED", citation: "ADA Standards of Care (hypoglycemia <70 mg/dL)",
    title: "Low blood glucose",
    messageWarn: "A reading of {v} mg/dL is below 70, which clinicians call low blood sugar — worth discussing with your clinician.",
    messageCritical: "A reading of {v} mg/dL is in the range of severe hypoglycemia. If you feel confused, shaky, or faint, treat per your clinician's hypoglycemia plan and seek help.",
  },
  bp_high: {
    kind: "bp_high", direction: "high", warnAt: 140, criticalAt: 180,
    evidenceLevel: "FDA_APPROVED", citation: "ACC/AHA 2017 BP guideline",
    title: "Elevated blood pressure",
    messageWarn: "Your last reading {v} is at or above 140/90 — keep discussing your blood pressure with your clinician.",
    messageCritical: "A blood pressure of {v} is in the range clinicians call a hypertensive crisis. If you have chest pain, vision change, or trouble speaking, seek care now; otherwise contact your clinician promptly.",
  },
  bp_low: {
    kind: "bp_low", direction: "low", warnAt: 90,
    evidenceLevel: "HUMAN_OBS", citation: "Standard hypotension reference (systolic <90 mmHg)",
    title: "Low blood pressure",
    messageWarn: "Your last reading {v} is on the low side — if you feel dizzy, lightheaded, or faint when standing, mention it to your clinician.",
  },
  neuro_worsening: {
    kind: "neuro_worsening", direction: "high", warnAt: 6, criticalAt: 8,
    evidenceLevel: "HUMAN_OBS", citation: "Conservative default — new or worsening neurologic symptoms warrant clinical evaluation",
    title: "Nerve symptoms",
    messageWarn: "You rated your nerve symptoms {v}/10 recently, higher than your usual — worth flagging with your clinician given your history.",
    messageCritical: "You rated your nerve symptoms {v}/10. New or rapidly worsening numbness, weakness, or loss of function should be evaluated; please contact your clinician, and seek care for sudden severe weakness.",
  },
  side_effect_cluster: {
    // No numeric — severity comes from the engine (count of concurrent AE signals).
    kind: "side_effect_cluster",
    evidenceLevel: "ANECDOTAL", citation: "Pattern signal — multiple concurrent self-reported effects",
    title: "Several side effects at once",
    messageWarn: "A few side-effect signals are showing up together in your recent logs — that pattern is worth reviewing with your clinician to make sure nothing is being missed.",
  },
  unsafe_stack: {
    // No numeric — severity comes from the contraindication evaluator.
    kind: "unsafe_stack",
    evidenceLevel: "HUMAN_OBS", citation: "Compound contraindication catalog",
    title: "Possible contraindication",
    messageWarn: "One of your active compounds may have a contraindication with something in your health profile — please review this with your clinician before continuing.",
    messageCritical: "One of your active compounds may have a serious contraindication with something in your health profile. Please review this with your clinician before continuing.",
  },
  adherence_drop: {
    kind: "adherence_drop", direction: "low", warnAt: 70,
    evidenceLevel: "ANECDOTAL", citation: "Conservative default — sustained adherence supports tracking accuracy and outcomes",
    title: "Adherence has dropped",
    messageWarn: "About {v}% of your recent scheduled doses were logged as taken, lower than before — if you're intentionally changing your routine, it's worth noting that for your clinician.",
  },
};
