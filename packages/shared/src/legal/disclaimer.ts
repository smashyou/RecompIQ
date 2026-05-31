import type { LegalDoc } from "./types";
import { LEGAL_UPDATED } from "./types";

export const DISCLAIMER: LegalDoc = {
  slug: "medical-disclaimer",
  title: "Medical Disclaimer",
  updated: LEGAL_UPDATED,
  summary:
    "RecompIQ is for education and tracking only. It is not medical advice, it does not create a clinician relationship, and it is not a substitute for professional care.",
  sections: [
    {
      heading: "Not medical advice",
      body: [
        "The content and features in RecompIQ — including compound information, evidence summaries, literature dose ranges, reconstitution calculators, projections, and AI coach responses — are provided for general educational and informational purposes only. They are not medical advice and are not a substitute for diagnosis, treatment, or advice from a qualified clinician.",
      ],
    },
    {
      heading: "No clinician–patient relationship",
      body: [
        "Using RecompIQ does not create a doctor–patient or other professional relationship between you and RecompIQ or anyone associated with it. We do not practice medicine and do not provide individualized medical recommendations.",
      ],
    },
    {
      heading: "Always consult a licensed clinician",
      body: [
        "Talk to a licensed healthcare professional who knows your history before starting, changing, or stopping any protocol, medication, supplement, peptide, diet, or training program, and before acting on anything you read or generate in the Service. Do not disregard or delay professional advice because of something in the Service.",
      ],
    },
    {
      heading: "Emergencies",
      body: [
        "RecompIQ is not for emergencies. If you may be experiencing a medical emergency, call your local emergency number or go to the nearest emergency department immediately.",
      ],
    },
    {
      heading: "No endorsement of any compound",
      body: [
        "References to peptides or other compounds are descriptive and educational. They are not endorsements, recommendations, or instructions to use, obtain, or administer any substance. Many compounds discussed are not approved for human use. See our Research-Use Statement.",
      ],
    },
    {
      heading: "Individual results and risks vary",
      body: [
        "Health, fitness, and physiological responses vary by individual and carry risk. Projections and estimates are illustrative, not guarantees. What is safe or effective for one person may be harmful to another.",
      ],
    },
    {
      heading: "Calculators are math, not recommendations",
      body: [
        "The reconstitution and dosing calculators perform arithmetic on numbers you enter. They do not recommend a dose, validate that a dose is safe or appropriate for you, or constitute a prescription. Verify everything with your clinician.",
      ],
    },
    {
      heading: "Evidence grading is educational",
      body: [
        "Evidence levels and citations are provided to help you judge the quality of available research. They may be incomplete or out of date and are not a determination that a compound is safe, effective, legal, or appropriate for you.",
      ],
    },
    {
      heading: "Your responsibility",
      body: [
        "You are solely responsible for any decision you make and any action you take in connection with your health. By using RecompIQ you acknowledge and accept this.",
      ],
    },
  ],
};
