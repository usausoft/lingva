import { describe, expect, it } from 'vitest';
import {
  isLingvaOnboardingPlanTier,
  isLingvaOnboardingRole,
  LINGVA_ONBOARDING_PLAN_TIERS,
  LINGVA_ONBOARDING_ROLES,
} from './onboarding';

describe('hosted onboarding contracts', () => {
  it('recognizes every supported platform role', () => {
    expect(LINGVA_ONBOARDING_ROLES.every(isLingvaOnboardingRole)).toBe(true);
    expect(isLingvaOnboardingRole('owner')).toBe(false);
  });

  it('recognizes every supported plan tier', () => {
    expect(LINGVA_ONBOARDING_PLAN_TIERS.every(isLingvaOnboardingPlanTier)).toBe(true);
    expect(isLingvaOnboardingPlanTier('enterprise')).toBe(false);
  });
});
