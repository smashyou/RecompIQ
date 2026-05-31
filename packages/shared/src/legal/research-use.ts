import type { LegalDoc } from "./types";
import { LEGAL_UPDATED } from "./types";

export const RESEARCH_USE: LegalDoc = {
  slug: "research-use",
  title: "Research-Use Statement",
  updated: LEGAL_UPDATED,
  summary:
    "Compound information in RecompIQ is for research and education only. Many compounds are not approved for human use and are not for human consumption. RecompIQ does not sell, supply, source, or instruct anyone to obtain or administer any substance.",
  sections: [
    {
      heading: "Purpose of this statement",
      body: [
        "RecompIQ includes a catalog of peptides and other compounds with educational summaries, mechanisms, graded evidence, cited literature, and reconstitution math. This statement explains the strict research-and-education boundary that governs that content.",
      ],
    },
    {
      heading: "Research and educational use only",
      body: [
        "All compound information in the Service is provided strictly for research and educational purposes. It is intended to help users understand the published science and to organize protocols they or their clinicians have independently decided upon. It is not guidance to use any substance.",
      ],
    },
    {
      heading: "Not for human consumption",
      body: [
        "Many compounds referenced in the Service are research chemicals that have not been evaluated or approved by the U.S. Food and Drug Administration (or comparable authorities) for human use, and are not intended for human or animal consumption. Where a compound is described, that description is informational and is not a representation that the compound is safe, legal, or appropriate for any use.",
      ],
    },
    {
      heading: "No sale, supply, or sourcing",
      body: [
        "RecompIQ does not sell, distribute, compound, dispense, supply, or source any peptide, medication, supplement, or other substance, and does not facilitate, broker, or link to the purchase of any such substance. The Service is software for information and tracking only.",
      ],
    },
    {
      heading: "No instructions to obtain or administer",
      body: [
        "The Service does not instruct anyone on how to acquire, possess, or administer any substance. Literature dose ranges and reconstitution calculations are educational reference and arithmetic only — they are not directions, a protocol recommendation, or a prescription.",
      ],
    },
    {
      heading: "User- and clinician-supplied protocols",
      body: [
        "Any protocol, dose, frequency, or stack tracked in the Service is entered by you or your clinician and reflects your own independent decisions. The Service records and organizes that information; it does not originate or endorse it.",
      ],
    },
    {
      heading: "Legal compliance is your responsibility",
      body: [
        "Laws governing peptides and other compounds differ by country, state, and locality and change over time. You are solely responsible for determining and complying with the laws that apply to you. Nothing in the Service should be read as advice that any particular acquisition, possession, or use is lawful.",
      ],
    },
    {
      heading: "Evidence grading is educational, not a recommendation",
      body: [
        "Evidence levels (for example human RCT, animal, mechanistic, anecdotal) and FDA-approval flags are provided to convey the quality and source of available research. They are educational signals, not a recommendation, certification, or assurance of safety, efficacy, or legality.",
      ],
    },
  ],
};
