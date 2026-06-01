export * from "./profile";
export * from "./goal";
export * from "./condition";
export * from "./medication";
export * from "./injury";
export * from "./vision";

export const ONBOARDING_STEPS = [
  "consent",
  "welcome",
  "profile",
  "goal",
  "conditions",
  "medications",
  "injuries",
  "goals",
  "done",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
