import { describe, expect, it } from 'vitest';
import {
  LINGVA_TRANSLATION_KEY_MAX_LENGTH,
  assertLingvaTranslationKey,
  getLingvaTranslationKeyValidationError,
  isLingvaTranslationKey,
} from './translation-keys';

describe('translation key contract', () => {
  it('accepts portable flattened key paths up to the shared limit', () => {
    expect(isLingvaTranslationKey('docs.python.getting-started_1')).toBe(true);
    expect(isLingvaTranslationKey('a'.repeat(LINGVA_TRANSLATION_KEY_MAX_LENGTH))).toBe(true);
  });

  it('rejects keys that cannot cross every Lingva plane', () => {
    expect(getLingvaTranslationKeyValidationError('a'.repeat(LINGVA_TRANSLATION_KEY_MAX_LENGTH + 1))).toMatch(
      /200 characters/u
    );
    expect(isLingvaTranslationKey('docs..intro')).toBe(false);
    expect(isLingvaTranslationKey('docs/intro')).toBe(false);
    expect(() => assertLingvaTranslationKey('docs.')).toThrow(/end with a dot/u);
  });
});
