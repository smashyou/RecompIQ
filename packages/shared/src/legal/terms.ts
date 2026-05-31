import type { LegalDoc } from "./types";
import { LEGAL_CONTACT, LEGAL_ENTITY, LEGAL_JURISDICTION, LEGAL_UPDATED } from "./types";

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Use",
  updated: LEGAL_UPDATED,
  summary:
    "The rules for using RecompIQ. RecompIQ is an educational and research-tracking tool — it is not medical care, and it does not sell, supply, or prescribe any compound.",
  sections: [
    {
      heading: "1. Acceptance of these Terms",
      body: [
        `These Terms of Use ("Terms") are a binding agreement between you and ${LEGAL_ENTITY} ("RecompIQ", "we", "us"). By creating an account or using the RecompIQ web or mobile applications (the "Service"), you agree to these Terms, our Privacy Policy, our Medical Disclaimer, and our Research-Use Statement. If you do not agree, do not use the Service.`,
      ],
    },
    {
      heading: "2. Eligibility",
      body: [
        "You must be at least 18 years old and able to form a binding contract to use the Service. The Service is not directed to anyone under 18, and we do not knowingly allow them to register.",
        "You are responsible for ensuring that your use of the Service is lawful where you live.",
      ],
    },
    {
      heading: "3. What RecompIQ is — and is not",
      body: [
        "RecompIQ is an informational and self-tracking tool for body recomposition, nutrition, training, biomarkers, and user-entered compound protocols, including an AI assistant that summarizes and grades publicly available research.",
        "RecompIQ is NOT a medical provider, pharmacy, compounding service, marketplace, or source for any substance. We do not sell, supply, source, prescribe, dispense, or recommend peptides, medications, supplements, or any other compound. We do not facilitate transactions for any such substance.",
        "All compound entries, doses, frequencies, and protocols in the Service are supplied by you or your clinician. The Service stores and organizes what you enter; it does not originate prescriptions.",
      ],
    },
    {
      heading: "4. Educational and research use only",
      body: [
        "Information in the Service — including descriptions of peptides and other compounds, mechanisms, evidence summaries, literature dose ranges, and reconstitution calculations — is provided for general educational and research purposes only.",
        "Many compounds referenced in the Service are research chemicals that are not approved for human use and are not intended for human consumption. Nothing in the Service is an offer, encouragement, or instruction to obtain, possess, or administer any substance. See our Research-Use Statement.",
      ],
    },
    {
      heading: "5. No medical advice",
      body: [
        "The Service does not provide medical advice, diagnosis, or treatment, and using it does not create a clinician–patient relationship. Always consult a licensed clinician before starting, changing, or stopping any protocol. See our Medical Disclaimer, which is incorporated into these Terms.",
      ],
    },
    {
      heading: "6. Your account",
      body: [
        "You are responsible for the accuracy of the information you provide, for keeping your credentials secure, and for all activity under your account. Notify us promptly of any unauthorized use.",
      ],
    },
    {
      heading: "7. Your content and data",
      body: [
        "You retain ownership of the data you enter (weights, vitals, symptoms, foods, photos, protocols, notes, etc.). You grant us a limited license to host, process, and display that data solely to operate the Service for you. You can export or delete your data at any time, as described in the Privacy Policy.",
      ],
    },
    {
      heading: "8. Acceptable use",
      body: [
        "You agree not to use the Service to:",
        "• buy, sell, source, advertise, or facilitate the transfer of any regulated or prescription substance;",
        "• obtain instructions to acquire or administer any substance for unlawful or unsafe purposes;",
        "• violate any law, or any third party's rights;",
        "• misrepresent the Service's outputs as medical advice or as a prescription;",
        "• reverse engineer, scrape, overload, or interfere with the Service or its security.",
      ],
    },
    {
      heading: "9. Intellectual property",
      body: [
        "The Service, including its software, design, text, and branding, is owned by RecompIQ or its licensors and is protected by intellectual-property laws. We grant you a limited, revocable, non-transferable license to use the Service for your personal, non-commercial purposes under these Terms.",
      ],
    },
    {
      heading: "10. Third-party services and information",
      body: [
        "The Service relies on third-party providers (for example cloud hosting, AI model providers, and nutrition databases) and may reference third-party research. We do not control and are not responsible for third-party content, accuracy, or availability, and a reference is not an endorsement.",
      ],
    },
    {
      heading: "11. Disclaimer of warranties",
      body: [
        'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE OR ANY INFORMATION IN IT IS ACCURATE, COMPLETE, CURRENT, OR SAFE FOR YOUR CIRCUMSTANCES.',
      ],
    },
    {
      heading: "12. Limitation of liability",
      body: [
        "TO THE MAXIMUM EXTENT PERMITTED BY LAW, RECOMPIQ AND ITS OFFICERS, EMPLOYEES, AND SUPPLIERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY PERSONAL INJURY, ARISING FROM YOUR USE OF (OR INABILITY TO USE) THE SERVICE OR ANY DECISION YOU MAKE BASED ON IT. OUR TOTAL LIABILITY WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US IN THE PRIOR TWELVE MONTHS OR USD $100.",
      ],
    },
    {
      heading: "13. Indemnification",
      body: [
        "You agree to indemnify and hold RecompIQ harmless from claims, damages, and expenses arising from your use of the Service, your content, or your violation of these Terms or any law.",
      ],
    },
    {
      heading: "14. Termination",
      body: [
        "You may stop using the Service and delete your account at any time. We may suspend or terminate access if you violate these Terms or to protect the Service or others.",
      ],
    },
    {
      heading: "15. Changes",
      body: [
        "We may update the Service or these Terms. Material changes will be posted in the Service with an updated date. Continued use after changes take effect means you accept the revised Terms.",
      ],
    },
    {
      heading: "16. Governing law",
      body: [
        `These Terms are governed by the laws of ${LEGAL_JURISDICTION}, without regard to conflict-of-laws rules. Disputes will be resolved in the courts located there, unless applicable law requires otherwise.`,
      ],
    },
    {
      heading: "17. Contact",
      body: [`Questions about these Terms: ${LEGAL_CONTACT}.`],
    },
  ],
};
