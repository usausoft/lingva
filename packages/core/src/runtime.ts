import type {
  LingvaConfig,
  LingvaDictionary,
  LingvaFlatDictionary,
  LingvaMessage,
  LingvaMessageVariant,
  LingvaMessageVariantSelector,
  LingvaMessageVariants,
  LingvaResources,
  LingvaResourceLoader,
  LocaleName,
  MissingTranslationContext,
  TranslationKey,
  TranslationOptions,
} from './contracts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLingvaMessageVariant(value: unknown): value is LingvaMessageVariant {
  return (
    isRecord(value) && typeof value.id === 'string' && value.id.trim().length > 0 && typeof value.text === 'string'
  );
}

function isLingvaMessageVariants(value: unknown): value is LingvaMessageVariants {
  return Array.isArray(value) && value.every(isLingvaMessageVariant);
}

function logLingvaContractError(path: string, detail: string): void {
  console.error(`[Lingva contract] ${detail} at "${path}".`);
}

function flattenLingvaDictionary(
  dictionary: LingvaDictionary | Partial<Record<string, LingvaMessage>>,
  prefix = ''
): LingvaFlatDictionary {
  const output: LingvaFlatDictionary = {};

  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      output[path] = value;
      continue;
    }

    if (Array.isArray(value)) {
      if (isLingvaMessageVariants(value)) {
        output[path] = value;
      } else {
        logLingvaContractError(path, 'Expected a variant message array with { id, text } objects');
      }

      continue;
    }

    if (isRecord(value)) {
      Object.assign(output, flattenLingvaDictionary(value, path));
      continue;
    }

    logLingvaContractError(path, `Unsupported translation leaf of type "${typeof value}"`);
  }

  return output;
}

function matchesVariantSelector(variant: LingvaMessageVariant, selector: LingvaMessageVariantSelector): boolean {
  return Object.entries(selector).every(([key, expectedValue]) => {
    if (expectedValue === undefined) {
      return true;
    }

    return variant[key as keyof LingvaMessageVariant] === expectedValue;
  });
}

function resolveLingvaMessageTemplate(message: LingvaMessage, variant?: string | LingvaMessageVariantSelector): string {
  if (typeof message === 'string') {
    return message;
  }

  if (message.length === 0) {
    return '';
  }

  if (typeof variant === 'string') {
    return message.find((entry) => entry.id === variant)?.text ?? message[0]?.text ?? '';
  }

  if (variant) {
    return message.find((entry) => matchesVariantSelector(entry, variant))?.text ?? message[0]?.text ?? '';
  }

  return message[0]?.text ?? '';
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, source);
}

function stringifyInterpolationValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }

  return String(value);
}

function findMatchingBrace(source: string, openingBraceIndex: number): number {
  let depth = 0;

  for (let i = openingBraceIndex; i < source.length; i += 1) {
    const char = source[i];

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function findTopLevelComma(source: string, start = 0): number {
  let depth = 0;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      return i;
    }
  }

  return -1;
}

function parseIcuOptions(body: string): Record<string, string> {
  const options: Record<string, string> = {};
  let index = 0;

  const skipWhitespace = () => {
    while (index < body.length && /\s/.test(body[index] ?? '')) {
      index += 1;
    }
  };

  while (index < body.length) {
    skipWhitespace();

    if (index >= body.length) {
      break;
    }

    const selectorMatch = /^([^\s{]+)/.exec(body.slice(index));

    if (!selectorMatch) {
      break;
    }

    const selector = selectorMatch[1] ?? '';
    index += selector.length;
    skipWhitespace();

    if (!selector || body[index] !== '{') {
      break;
    }

    const optionEnd = findMatchingBrace(body, index);

    if (optionEnd === -1) {
      break;
    }

    options[selector] = body.slice(index + 1, optionEnd);
    index = optionEnd + 1;
  }

  return options;
}

function resolveSimpleToken(token: string, variables: Record<string, unknown>): string | null {
  const value = getNestedValue(variables, token.trim());

  if (value === undefined) {
    return null;
  }

  return stringifyInterpolationValue(value);
}

function renderIcuTemplate(template: string, variables: Record<string, unknown>, locale: string): string {
  let output = '';
  let index = 0;

  while (index < template.length) {
    const openIndex = template.indexOf('{', index);

    if (openIndex === -1) {
      output += template.slice(index);
      break;
    }

    // Keep moustache tokens untouched here and resolve them later.
    if (template[openIndex + 1] === '{') {
      output += template.slice(index, openIndex + 2);
      index = openIndex + 2;
      continue;
    }

    output += template.slice(index, openIndex);

    const closeIndex = findMatchingBrace(template, openIndex);

    if (closeIndex === -1) {
      output += template.slice(openIndex);
      break;
    }

    const expression = template.slice(openIndex + 1, closeIndex).trim();
    const firstComma = findTopLevelComma(expression);

    if (firstComma === -1) {
      const resolvedToken = resolveSimpleToken(expression, variables);
      output += resolvedToken ?? template.slice(openIndex, closeIndex + 1);
      index = closeIndex + 1;
      continue;
    }

    const secondComma = findTopLevelComma(expression, firstComma + 1);

    if (secondComma === -1) {
      output += template.slice(openIndex, closeIndex + 1);
      index = closeIndex + 1;
      continue;
    }

    const variablePath = expression.slice(0, firstComma).trim();
    const formatType = expression.slice(firstComma + 1, secondComma).trim();
    const optionsBody = expression.slice(secondComma + 1).trim();
    const options = parseIcuOptions(optionsBody);
    const rawValue = getNestedValue(variables, variablePath);

    if (formatType === 'select') {
      const selector = rawValue === undefined || rawValue === null ? 'other' : String(rawValue);
      const selected = options[selector] ?? options.other;

      if (selected === undefined) {
        output += template.slice(openIndex, closeIndex + 1);
      } else {
        output += renderIcuTemplate(selected, variables, locale);
      }

      index = closeIndex + 1;
      continue;
    }

    if (formatType === 'plural' || formatType === 'selectordinal') {
      const count = Number(rawValue);

      if (!Number.isFinite(count)) {
        output += template.slice(openIndex, closeIndex + 1);
        index = closeIndex + 1;
        continue;
      }

      const exactKey = `=${count}`;
      const pluralType = formatType === 'selectordinal' ? 'ordinal' : 'cardinal';
      const category = new Intl.PluralRules(locale, {
        type: pluralType,
      }).select(count);
      const selected = options[exactKey] ?? options[category] ?? options.other;

      if (selected === undefined) {
        output += template.slice(openIndex, closeIndex + 1);
      } else {
        const withHash = selected.replaceAll('#', String(count));
        output += renderIcuTemplate(withHash, variables, locale);
      }

      index = closeIndex + 1;
      continue;
    }

    output += template.slice(openIndex, closeIndex + 1);
    index = closeIndex + 1;
  }

  return output;
}

function interpolate(template: string, variables?: Record<string, unknown>, locale = 'en'): string {
  if (!variables) {
    return template;
  }

  const icuResolved = renderIcuTemplate(template, variables, locale);

  return icuResolved.replaceAll(/\{\{\s*([\w.]+)\s*\}\}/g, (fullMatch, moustacheKey) => {
    const token = String(moustacheKey);
    const value = getNestedValue(variables, token);

    return value === undefined ? fullMatch : stringifyInterpolationValue(value);
  });
}

export class LingvaClient<Resources extends LingvaResources = LingvaResources> {
  readonly apiKey?: string;
  readonly apiUrl?: string;
  readonly projectId?: string;
  readonly environment?: string;

  private readonly locales: LocaleName<Resources>[];
  private locale: LocaleName<Resources>;
  private readonly fallbackLocale?: LocaleName<Resources>;
  private readonly loader?: LingvaResourceLoader<Resources>;
  private resources: Record<string, LingvaFlatDictionary>;

  /**
   * Creates a runtime client around local resources and an optional async loader.
   */
  constructor(config: LingvaConfig<Resources> = {}) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
    this.projectId = config.projectId;
    this.environment = config.environment;
    this.locales = Array.from(
      new Set([
        ...(config.locales ?? []),
        ...(config.defaultLocale ? [config.defaultLocale] : []),
        ...(config.locale ? [config.locale] : []),
        ...Object.keys(config.resources ?? {}),
      ])
    ) as LocaleName<Resources>[];
    this.locale = (config.locale ?? config.defaultLocale ?? 'en') as LocaleName<Resources>;
    this.fallbackLocale = config.fallbackLocale;
    this.loader = config.loader;
    this.resources = Object.fromEntries(
      Object.entries(structuredClone((config.resources ?? {}) as Resources)).map(([locale, dictionary]) => [
        locale,
        flattenLingvaDictionary(dictionary),
      ])
    );
  }

  /**
   * Returns the currently active locale.
   */
  getLocale(): LocaleName<Resources> {
    return this.locale;
  }

  /**
   * Updates the currently active locale for subsequent lookups.
   */
  setLocale(locale: LocaleName<Resources>): void {
    this.locale = locale;
  }

  /**
   * Lists locales currently loaded into the client.
   */
  getAvailableLocales(): LocaleName<Resources>[] {
    const loadedLocales = Object.keys(this.resources) as LocaleName<Resources>[];
    const locales = new Set<LocaleName<Resources>>([...this.locales, ...loadedLocales]);

    return Array.from(locales);
  }

  /**
   * Checks whether a locale already contains a specific translation key.
   */
  has<Key extends TranslationKey<Resources>>(locale: LocaleName<Resources>, key: Key): boolean {
    const dictionary = this.resources[locale] as LingvaFlatDictionary | undefined;

    return dictionary?.[key] !== undefined;
  }

  /**
   * Merges new resource entries into the in-memory locale dictionary.
   */
  loadResources<Locale extends LocaleName<Resources>>(
    locale: Locale,
    entries: Partial<Record<TranslationKey<Resources>, LingvaMessage>> | Partial<Resources[Locale]>
  ): void {
    const dictionary = this.resources[locale] ?? {};
    const flattenedEntries = flattenLingvaDictionary(entries as LingvaDictionary);

    this.resources[locale] = {
      ...dictionary,
      ...flattenedEntries,
    };
  }

  private async loadRemoteResources(
    locale: LocaleName<Resources>,
    keys?: TranslationKey<Resources>[],
    force = false,
    signal?: AbortSignal
  ): Promise<void> {
    if (!this.loader) {
      return;
    }

    const entries = await this.loader.load(
      {
        force,
        locale,
        keys,
        signal,
      },
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
        projectId: this.projectId,
        environment: this.environment,
      }
    );

    this.loadResources(locale, entries);
  }

  /**
   * Hydrates a set of keys for a locale through the configured remote loader.
   */
  async preload(
    keys: TranslationKey<Resources>[],
    locale = this.locale,
    options: { force?: boolean; signal?: AbortSignal } = {}
  ): Promise<void> {
    await this.loadRemoteResources(locale, keys, options.force ?? false, options.signal);
  }

  /**
   * Forces a locale refresh through the configured loader, bypassing delivery cache.
   */
  async refresh(
    locale = this.locale,
    keys?: TranslationKey<Resources>[],
    options: { signal?: AbortSignal } = {}
  ): Promise<void> {
    await this.loadRemoteResources(locale, keys, true, options.signal);
  }

  /**
   * Returns the raw message contract for a key, preserving variant arrays when present.
   */
  getMessage<Key extends TranslationKey<Resources>>(
    key: Key,
    options: Pick<TranslationOptions<Resources, Key>, 'locale' | 'fallback'> = {}
  ): LingvaMessage | undefined {
    const locale = options.locale ?? this.locale;
    const fallbackLocale = options.fallback === false ? undefined : (options.fallback ?? this.fallbackLocale);

    const activeDictionary = this.resources[locale] as LingvaFlatDictionary | undefined;
    const fallbackDictionary = fallbackLocale
      ? ((this.resources[fallbackLocale] as LingvaFlatDictionary | undefined) ?? undefined)
      : undefined;

    return activeDictionary?.[key] ?? fallbackDictionary?.[key];
  }

  /**
   * Resolves a translation synchronously using local resources plus fallback behavior.
   */
  tSync<Key extends TranslationKey<Resources>>(key: Key, options: TranslationOptions<Resources, Key> = {}): string {
    const locale = options.locale ?? this.locale;
    const message =
      this.getMessage(key, {
        locale,
        fallback: options.fallback,
      }) ??
      options.defaultValue ??
      key;

    return interpolate(
      resolveLingvaMessageTemplate(message, options.variant),
      options.variables as Record<string, unknown> | undefined,
      String(locale)
    );
  }

  /**
   * Resolves a translation asynchronously, hydrating missing keys before falling
   * back to the synchronous lookup path.
   */
  async t<Key extends TranslationKey<Resources>>(
    key: Key,
    options: TranslationOptions<Resources, Key> = {}
  ): Promise<string> {
    const locale = options.locale ?? this.locale;
    const fallbackLocale = options.fallback === false ? undefined : (options.fallback ?? this.fallbackLocale);
    const needsActiveLocaleLoad = !this.has(locale, key);
    const needsFallbackLoad =
      fallbackLocale !== undefined && fallbackLocale !== locale && !this.has(fallbackLocale, key);

    // Async lookup can hydrate the active locale first, then fallback locale if
    // needed, before returning to the local-only resolution path.
    if (needsActiveLocaleLoad) {
      await this.loadRemoteResources(locale, [key], false, options.signal);
    }

    if (needsFallbackLoad) {
      await this.loadRemoteResources(fallbackLocale, [key], false, options.signal);
    }

    return this.tSync(key, options);
  }

  /**
   * Returns missing-translation metadata when a key cannot be found locally or through fallback.
   */
  getMissingTranslationContext<Key extends TranslationKey<Resources>>(
    key: Key,
    options: TranslationOptions<Resources, Key> = {}
  ): MissingTranslationContext<Resources, Key> | null {
    const locale = options.locale ?? this.locale;
    const fallbackLocale = options.fallback === false ? undefined : (options.fallback ?? this.fallbackLocale);

    const activeDictionary = this.resources[locale] as LingvaFlatDictionary | undefined;

    if (activeDictionary?.[key] !== undefined) {
      return null;
    }

    if (fallbackLocale) {
      const fallbackDictionary = this.resources[fallbackLocale] as LingvaFlatDictionary | undefined;

      if (fallbackDictionary?.[key] !== undefined) {
        return null;
      }
    }

    return {
      key,
      locale,
      fallbackLocale,
    };
  }
}

/**
 * Backwards-compatible alias kept for the original runtime entry point.
 */
export class Lingva<Resources extends LingvaResources = LingvaResources> extends LingvaClient<Resources> {}
