/** Maximum length of one flattened translation-key path across all Lingva planes. */
export const LINGVA_TRANSLATION_KEY_MAX_LENGTH = 200;

/** Source shared with standalone boundaries that cannot import the core runtime. */
export const LINGVA_TRANSLATION_KEY_PATTERN_SOURCE = '^[A-Za-z0-9][A-Za-z0-9_.-]*$';

const LINGVA_TRANSLATION_KEY_PATTERN = new RegExp(LINGVA_TRANSLATION_KEY_PATTERN_SOURCE, 'u');

/**
 * Returns a stable validation message when a flattened translation key does
 * not satisfy the public Lingva contract.
 */
export function getLingvaTranslationKeyValidationError(key: string): string | undefined {
  if (!key) {
    return 'Lingva translation key is required.';
  }

  if (key.length > LINGVA_TRANSLATION_KEY_MAX_LENGTH) {
    return `Lingva translation key must be at most ${LINGVA_TRANSLATION_KEY_MAX_LENGTH} characters.`;
  }

  if (key.endsWith('.')) {
    return 'Lingva translation key must not end with a dot.';
  }

  if (key.includes('..')) {
    return 'Lingva translation key must not contain consecutive dots.';
  }

  if (!LINGVA_TRANSLATION_KEY_PATTERN.test(key)) {
    return 'Lingva translation key may only use letters, digits, dots, underscores, and hyphens, and must start with a letter or digit.';
  }

  return undefined;
}

export function isLingvaTranslationKey(key: string): boolean {
  return getLingvaTranslationKeyValidationError(key) === undefined;
}

/** Rejects invalid translation keys before they cross a storage or delivery boundary. */
export function assertLingvaTranslationKey(key: string): void {
  const error = getLingvaTranslationKeyValidationError(key);

  if (error) {
    throw new Error(error);
  }
}
