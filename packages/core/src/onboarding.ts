export const LINGVA_ONBOARDING_ROLES = ['admin', 'customer', 'dev', 'staff', 'support'] as const;
export const LINGVA_ONBOARDING_PLAN_TIERS = ['free', 'plus', 'pro', 'business', 'internal'] as const;

export type LingvaOnboardingRole = (typeof LINGVA_ONBOARDING_ROLES)[number];
export type LingvaOnboardingPlanTier = (typeof LINGVA_ONBOARDING_PLAN_TIERS)[number];

/** Validates a platform role received across the hosted onboarding boundary. */
export function isLingvaOnboardingRole(value: unknown): value is LingvaOnboardingRole {
  return LINGVA_ONBOARDING_ROLES.some((role) => role === value);
}

/** Validates a plan tier received across the hosted onboarding boundary. */
export function isLingvaOnboardingPlanTier(value: unknown): value is LingvaOnboardingPlanTier {
  return LINGVA_ONBOARDING_PLAN_TIERS.some((tier) => tier === value);
}
