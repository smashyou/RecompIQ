import type { LegalDoc } from "./types";
import { LEGAL_ENTITY, LEGAL_UPDATED, PRIVACY_CONTACT } from "./types";

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  updated: LEGAL_UPDATED,
  summary:
    "What we collect, how we use it, and the control you have. You enter sensitive health information; we use it only to run the Service for you, we never sell it, and you can export or delete it at any time.",
  sections: [
    {
      heading: "1. Overview",
      body: [
        `This Privacy Policy explains how ${LEGAL_ENTITY} ("RecompIQ") handles information in the RecompIQ web and mobile applications (the "Service"). We designed the Service to be privacy-protective: your data is scoped to your account, encrypted in transit and at rest, and never sold.`,
      ],
    },
    {
      heading: "2. Information you provide",
      body: [
        "• Account information: email and authentication credentials.",
        "• Profile and health information you choose to enter: sex, date of birth, height, weight, body composition, vitals (blood pressure, heart rate, glucose), symptoms, sleep, steps, water, conditions, medications, injuries, goals.",
        "• Nutrition and training data: foods, meals, workouts.",
        "• Compound tracking: user- or clinician-supplied protocols, doses, schedules, and adherence.",
        "• Photos you upload: meal photos and progress (body) photos.",
        "• Messages you send to the AI coach.",
      ],
    },
    {
      heading: "3. Information collected automatically",
      body: [
        "Basic device and usage information needed to operate and secure the Service (for example app version, error logs, and request metadata). We minimize this and do not use it to build advertising profiles.",
      ],
    },
    {
      heading: "4. Sensitive health information",
      body: [
        "Much of what you enter is sensitive health information. You provide it voluntarily to track your own health. We use it only to provide the Service to you. We do not sell it, and we do not share it for advertising.",
      ],
    },
    {
      heading: "5. How we use information",
      body: [
        "To operate core features (logging, dashboards, projections, reconstitution math, the AI coach); to secure and maintain the Service; to provide support; and to comply with law. We process your data on your behalf to deliver the educational and tracking features you request.",
      ],
    },
    {
      heading: "6. Service providers and sharing",
      body: [
        "We share data only with vendors that help us run the Service, under contracts that limit their use to that purpose:",
        "• Cloud database, authentication, and file storage (to host your account and data).",
        "• AI model providers, accessed through an AI gateway, to generate coach responses and parse food/lab photos. Prompts are sent for processing; we configure for zero data retention where the provider supports it, and we minimize personally identifying content in prompts.",
        "• Nutrition data providers, to look up foods you search.",
        "We do not sell personal information. We may disclose information if required by law or to protect rights and safety.",
      ],
    },
    {
      heading: "7. Health-app integrations",
      body: [
        "If you connect Apple Health (iOS) or Health Connect (Android), the Service reads only the categories you authorize (for example weight, body composition, steps, heart rate, sleep) to import them into your tracking. This access is granted by you through the operating system and can be revoked there at any time. Imported values are stored in your account like any other entry and are never sold.",
      ],
    },
    {
      heading: "8. Storage and security",
      body: [
        "Data is encrypted in transit and at rest. Access is enforced per-user at the database layer (row-level security), and photo access uses signed, expiring URLs. No method of storage or transmission is perfectly secure, but we work to protect your information and limit access to it.",
      ],
    },
    {
      heading: "9. Data retention",
      body: [
        "We keep your data while your account is active. When you delete data or your account, we delete the associated records, except where we must retain limited information to comply with law or resolve disputes.",
      ],
    },
    {
      heading: "10. Your rights and choices",
      body: [
        "• Access and export your data (JSON and CSV).",
        "• Correct information by editing it in the app.",
        "• Delete specific entries, or delete your entire account, which removes your associated data.",
        "• Withdraw health-app permissions in your device settings.",
        "Depending on where you live, you may have additional rights (for example under GDPR or CCPA); contact us to exercise them.",
      ],
    },
    {
      heading: "11. Children's privacy",
      body: [
        "The Service is for adults (18+). We do not knowingly collect information from anyone under 18. If you believe a minor has provided us information, contact us and we will delete it.",
      ],
    },
    {
      heading: "12. International users",
      body: [
        "We may process and store information in countries other than yours. By using the Service, you understand your information may be transferred to and processed in those locations with appropriate safeguards.",
      ],
    },
    {
      heading: "13. Changes",
      body: [
        "We may update this Policy. Material changes will be posted in the Service with a new date. Continued use means you accept the updated Policy.",
      ],
    },
    {
      heading: "14. Contact",
      body: [`Privacy questions or requests: ${PRIVACY_CONTACT}.`],
    },
  ],
};
