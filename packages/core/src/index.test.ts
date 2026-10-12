import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createLingvaClientFromRuntimeConfig,
  createLingvaProjectBundle,
  createLingvaPublishArtifacts,
  createLingvaHttpLoader,
  createLingvaLocalLoader,
  createLingvaProjectManifest,
  createLingvaWorkflowSummary,
  createLingvaResources,
  defineLingvaConfig,
  defineLingvaProject,
  formatLingvaProjectHelpersModule,
  formatLingvaProjectBundle,
  formatLingvaProjectManifest,
  formatLingvaPublishArtifacts,
  formatLingvaProjectTypeScriptModule,
  formatLingvaValidationReport,
  formatLingvaWorkflowSummary,
  Lingva,
  LingvaClient,
  resolveLingvaRuntimeSetup,
  shouldFailLingvaValidation,
  type TranslationVariant,
  type TranslationVariantId,
  type TranslationVariantSelector,
  type TranslationVariables,
  type LingvaProjectBundle,
  validateLingvaProject,
} from './index';

describe('Lingva core', () => {
  const resources = createLingvaResources({
    en: {
      'welcome.title': 'Welcome back',
      'welcome.message': 'Hello, {user.name}!',
      'dashboard.summary': 'You have {count} active projects.',
    },
    de: {
      'welcome.title': 'Willkommen zurueck',
      'welcome.message': 'Hallo, {user.name}!',
    },
  });

  const nestedResources = createLingvaResources({
    en: {
      auth: {
        signin: {
          title: 'Sign in',
          subtitle: 'Welcome back, {user.name}',
        },
      },
    },
    ru: {
      auth: {
        signin: {
          title: 'Войти',
        },
      },
    },
  });

  const variantResources = createLingvaResources({
    en: {
      marketing: {
        hero: {
          title: [
            {
              id: 'warm',
              tone: 'warm',
              text: 'Welcome back, {user.name}.',
            },
            {
              id: 'bold',
              tone: 'bold',
              text: 'Let us ship today, {user.name}.',
            },
          ],
        },
      },
    },
    ru: {
      marketing: {
        hero: {
          title: [
            {
              id: 'warm',
              tone: 'warm',
              text: 'С возвращением, {user.name}.',
            },
          ],
        },
      },
    },
  });

  it('creates a client instance', () => {
    const client = new Lingva({ apiKey: 'test' });

    expect(client).toBeInstanceOf(LingvaClient);
  });

  it('defaults remote runtime setup to the hosted current-bundle route', () => {
    const setup = resolveLingvaRuntimeSetup({
      mode: 'remote',
      apiUrl: 'https://delivery.example.com/',
      projectId: 'demo-project',
      environment: 'stage',
      locale: 'en',
    });

    expect(setup.config.delivery).toMatchObject({
      mode: 'cdn',
      url: 'https://delivery.example.com/bundles/{projectId}/{environment}/latest/{locale}.bundle.json',
    });
  });

  it('returns translations from the active locale', async () => {
    const client = new LingvaClient({
      locale: 'en',
      resources,
    });

    await expect(client.t('welcome.title')).resolves.toBe('Welcome back');
  });

  it('supports nested object resources as translation input', async () => {
    const client = new LingvaClient({
      locale: 'ru',
      fallbackLocale: 'en',
      resources: nestedResources,
    });

    await expect(client.t('auth.signin.title')).resolves.toBe('Войти');
    await expect(
      client.t('auth.signin.subtitle', {
        variables: {
          user: {
            name: 'Nino',
          },
        },
      })
    ).resolves.toBe('Welcome back, Nino');
  });

  it('supports variant arrays as translation leaves', async () => {
    const client = new LingvaClient({
      locale: 'en',
      fallbackLocale: 'ru',
      resources: variantResources,
    });

    await expect(
      client.t('marketing.hero.title', {
        variables: {
          user: {
            name: 'Nino',
          },
        },
      })
    ).resolves.toBe('Welcome back, Nino.');

    expect(
      client.tSync('marketing.hero.title', {
        variant: 'bold',
        variables: {
          user: {
            name: 'Nino',
          },
        },
      })
    ).toBe('Let us ship today, Nino.');
  });

  it('returns locale-specific values before using fallback', async () => {
    const client = new LingvaClient({
      locale: 'de',
      fallbackLocale: 'en',
      resources,
    });

    await expect(client.t('welcome.title')).resolves.toBe('Willkommen zurueck');
  });

  it('interpolates variables in translations', async () => {
    const client = new LingvaClient({
      locale: 'en',
      resources,
    });

    await expect(
      client.t('welcome.message', {
        variables: {
          user: {
            name: 'Yury',
          },
        },
      })
    ).resolves.toBe('Hello, Yury!');
  });

  it('supports ICU-style plural templates in one translation key', async () => {
    const client = new LingvaClient({
      locale: 'en',
      resources: {
        ...resources,
        en: {
          ...resources.en,
          'inbox.summary': '{count, plural, =0 {No messages} =1 {You have # message} other {You have # messages}}',
        },
      },
    });

    await expect(
      client.t('inbox.summary', {
        variables: {
          count: 0,
        },
      })
    ).resolves.toBe('No messages');

    await expect(
      client.t('inbox.summary', {
        variables: {
          count: 1,
        },
      })
    ).resolves.toBe('You have 1 message');

    await expect(
      client.t('inbox.summary', {
        variables: {
          count: 8,
        },
      })
    ).resolves.toBe('You have 8 messages');
  });

  it('resolves plural category branches for locales like Russian', async () => {
    const client = new LingvaClient({
      locale: 'ru',
      resources: {
        ...resources,
        ru: {
          'inbox.summary':
            '{count, plural, one {# novoe soobshchenie} few {# novyh soobshcheniya} many {# novyh soobshcheniy} other {# novyh soobshcheniy}}',
        },
      },
    });

    await expect(
      client.t('inbox.summary', {
        variables: {
          count: 1,
        },
      })
    ).resolves.toBe('1 novoe soobshchenie');

    await expect(
      client.t('inbox.summary', {
        variables: {
          count: 2,
        },
      })
    ).resolves.toBe('2 novyh soobshcheniya');

    await expect(
      client.t('inbox.summary', {
        variables: {
          count: 5,
        },
      })
    ).resolves.toBe('5 novyh soobshcheniy');
  });

  it('supports ICU select format', async () => {
    const client = new LingvaClient({
      locale: 'en',
      resources: {
        ...resources,
        en: {
          ...resources.en,
          'actor.pronoun': '{gender, select, male {He} female {She} other {They}} liked this.',
        },
      },
    });

    await expect(
      client.t('actor.pronoun', {
        variables: {
          gender: 'male',
        },
      })
    ).resolves.toBe('He liked this.');

    await expect(
      client.t('actor.pronoun', {
        variables: {
          gender: 'female',
        },
      })
    ).resolves.toBe('She liked this.');

    await expect(
      client.t('actor.pronoun', {
        variables: {
          gender: 'unknown',
        },
      })
    ).resolves.toBe('They liked this.');
  });

  it('supports ICU selectordinal format', async () => {
    const client = new LingvaClient({
      locale: 'en',
      resources: {
        ...resources,
        en: {
          ...resources.en,
          'rank.label': 'You finished {rank, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}.',
        },
      },
    });

    await expect(
      client.t('rank.label', {
        variables: {
          rank: 1,
        },
      })
    ).resolves.toBe('You finished 1st.');

    await expect(
      client.t('rank.label', {
        variables: {
          rank: 2,
        },
      })
    ).resolves.toBe('You finished 2nd.');

    await expect(
      client.t('rank.label', {
        variables: {
          rank: 4,
        },
      })
    ).resolves.toBe('You finished 4th.');
  });

  it('supports nested ICU blocks', async () => {
    const client = new LingvaClient({
      locale: 'en',
      resources: {
        ...resources,
        en: {
          ...resources.en,
          'nested.example':
            '{gender, select, male {{count, plural, =0 {He has no messages} other {He has # messages}}} other {{count, plural, =0 {They have no messages} other {They have # messages}}}}',
        },
      },
    });

    await expect(
      client.t('nested.example', {
        variables: {
          gender: 'male',
          count: 0,
        },
      })
    ).resolves.toBe('He has no messages');

    await expect(
      client.t('nested.example', {
        variables: {
          gender: 'other',
          count: 3,
        },
      })
    ).resolves.toBe('They have 3 messages');
  });

  it('uses a default value before falling back to the key itself', async () => {
    const client = new LingvaClient({
      locale: 'en',
    });

    await expect(
      client.t('missing.key', {
        defaultValue: 'Missing translation',
      })
    ).resolves.toBe('Missing translation');
  });

  it('can disable fallback per request', async () => {
    const client = new LingvaClient({
      locale: 'fr',
      fallbackLocale: 'en',
      resources: {
        ...resources,
        fr: {},
      },
    });

    await expect(
      client.t('welcome.title', {
        fallback: false,
      })
    ).resolves.toBe('welcome.title');
  });

  it('can preload resources through a remote loader contract', async () => {
    const client = new LingvaClient({
      locale: 'fr',
      fallbackLocale: 'en',
      resources: {
        ...resources,
        fr: {},
      },
      loader: {
        async load(request) {
          if (request.locale === 'fr') {
            return {
              'welcome.title': 'Bon retour',
            };
          }

          return {};
        },
      },
    });

    await client.preload(['welcome.title'], 'fr');

    expect(client.tSync('welcome.title', { locale: 'fr' })).toBe('Bon retour');
  });

  it('can lazily hydrate missing keys through the async loader', async () => {
    const client = new LingvaClient({
      locale: 'fr',
      fallbackLocale: 'en',
      resources: {
        ...resources,
        fr: {},
      },
      loader: {
        async load(request) {
          if (request.locale === 'fr' && request.keys?.includes('welcome.message')) {
            return {
              'welcome.message': 'Salut, {user.name}!',
            };
          }

          return {};
        },
      },
    });

    await expect(
      client.t('welcome.message', {
        locale: 'fr',
        variables: {
          user: {
            name: 'Nino',
          },
        },
      })
    ).resolves.toBe('Salut, Nino!');
  });

  it('creates a runtime config with local delivery settings', () => {
    const config = defineLingvaConfig({
      projectId: 'demo-project',
      environment: 'development',
      delivery: {
        mode: 'local',
        path: './translations/{locale}.lingva',
        cache: {
          memory: true,
          storage: false,
          strategy: 'build-time',
        },
      },
    });

    expect(config.delivery.mode).toBe('local');
    expectTypeOf(config.delivery.mode).toEqualTypeOf<'local'>();
  });

  it('keeps translation variable inference for variant arrays', () => {
    type HeroVariables = TranslationVariables<typeof variantResources, 'marketing.hero.title'>;

    expectTypeOf<HeroVariables>().toEqualTypeOf<{
      user: {
        name: string | number | boolean | null | undefined;
      };
    }>();
  });

  it('infers translation variant ids and selectors from variant arrays', () => {
    type HeroVariantId = TranslationVariantId<typeof variantResources, 'marketing.hero.title'>;
    type HeroVariantSelector = TranslationVariantSelector<typeof variantResources, 'marketing.hero.title'>;
    type HeroVariant = TranslationVariant<typeof variantResources, 'marketing.hero.title'>;

    expectTypeOf<HeroVariantId>().toEqualTypeOf<'warm' | 'bold'>();
    expectTypeOf<HeroVariantSelector['tone']>().toEqualTypeOf<'warm' | 'bold' | undefined>();
    expectTypeOf<'warm'>().toExtend<HeroVariant>();
    expectTypeOf<{ tone: 'bold' }>().toExtend<HeroVariant>();
  });

  it('loads locale resources through the HTTP delivery helper', async () => {
    const loader = createLingvaHttpLoader<typeof resources>({
      url: 'https://cdn.lingva.dev/bundles',
      apiKey: 'runtime-key',
      headers: {
        'x-lingva-env': 'production',
      },
      fetcher: async (input, init) => {
        const url = String(input);

        expect(url).toContain('locale=fr');
        expect(url).toContain('projectId=demo-project');
        expect(url).toContain('keys=welcome.title');
        expect(new Headers(init?.headers).get('x-api-key')).toBe('runtime-key');
        expect(new Headers(init?.headers).get('x-lingva-env')).toBe('production');

        return new Response(
          JSON.stringify({
            translations: {
              'welcome.title': 'Bonjour',
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      },
    });

    const payload = await loader.load(
      {
        locale: 'fr',
        keys: ['welcome.title'],
      },
      {
        projectId: 'demo-project',
      }
    );

    expect(payload).toEqual({
      'welcome.title': 'Bonjour',
    });
  });

  it('cancels HTTP delivery when the caller aborts the request', async () => {
    const controller = new AbortController();
    const loader = createLingvaHttpLoader<typeof resources>({
      url: 'https://cdn.lingva.dev/bundles/{locale}.json',
      fetcher: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        }),
    });
    const request = loader.load({ locale: 'fr', signal: controller.signal }, { projectId: 'demo-project' });

    controller.abort(new Error('consumer stopped waiting'));

    await expect(request).rejects.toThrow('consumer stopped waiting');
  });

  it('times out HTTP delivery requests that never settle', async () => {
    const loader = createLingvaHttpLoader<typeof resources>({
      url: 'https://cdn.lingva.dev/bundles/{locale}.json',
      timeoutMs: 5,
      fetcher: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
        }),
    });

    await expect(loader.load({ locale: 'fr' }, { projectId: 'demo-project' })).rejects.toThrow('timed out');
  });

  it('rejects invalid HTTP delivery timeout configuration', () => {
    expect(() =>
      createLingvaHttpLoader<typeof resources>({
        url: 'https://cdn.lingva.dev/bundles/{locale}.json',
        timeoutMs: 0,
      })
    ).toThrow(/timeoutMs/);
  });

  it('loads publish bundle payloads through the HTTP delivery helper', async () => {
    const loader = createLingvaHttpLoader<typeof resources>({
      url: 'https://cdn.lingva.dev/bundles/demo/local/latest/{locale}.bundle.json',
      fetcher: async () =>
        Response.json({
          locale: 'fr',
          messages: {
            'welcome.title': 'Bonjour from bundle',
          },
          variants: {
            'marketing.hero.title': [
              {
                id: 'warm',
                text: 'Bonjour warm',
              },
            ],
          },
        }),
    });

    await expect(loader.load({ locale: 'fr' }, { projectId: 'demo-project' })).resolves.toEqual({
      'marketing.hero.title': [
        {
          id: 'warm',
          text: 'Bonjour warm',
        },
      ],
      'welcome.title': 'Bonjour from bundle',
    });
  });

  it('reuses HTTP delivery payloads while cache TTL is fresh', async () => {
    let fetchCount = 0;
    const loader = createLingvaHttpLoader<typeof resources>({
      url: 'https://cdn.lingva.dev/bundles/{locale}.json',
      cache: {
        memory: true,
        ttl: 60,
      },
      fetcher: async () => {
        fetchCount += 1;

        return Response.json({
          translations: {
            'welcome.title': `Bonjour ${fetchCount}`,
          },
        });
      },
    });

    await expect(loader.load({ locale: 'fr' }, { projectId: 'demo-project' })).resolves.toEqual({
      'welcome.title': 'Bonjour 1',
    });
    await expect(loader.load({ locale: 'fr' }, { projectId: 'demo-project' })).resolves.toEqual({
      'welcome.title': 'Bonjour 1',
    });

    expect(fetchCount).toBe(1);
  });

  it('can force-refresh cached HTTP delivery payloads', async () => {
    let fetchCount = 0;
    const loader = createLingvaHttpLoader<typeof resources>({
      url: 'https://cdn.lingva.dev/bundles/{locale}.json',
      cache: {
        memory: true,
        ttl: 60,
      },
      fetcher: async () => {
        fetchCount += 1;

        return Response.json({
          translations: {
            'welcome.title': `Bonjour ${fetchCount}`,
          },
        });
      },
    });

    await loader.load({ locale: 'fr' }, { projectId: 'demo-project' });

    await expect(loader.load({ force: true, locale: 'fr' }, { projectId: 'demo-project' })).resolves.toEqual({
      'welcome.title': 'Bonjour 2',
    });

    expect(fetchCount).toBe(2);
  });

  it('returns stale payloads while background revalidation updates cache', async () => {
    let fetchCount = 0;
    const loader = createLingvaHttpLoader<typeof resources>({
      url: 'https://cdn.lingva.dev/bundles/{locale}.json',
      cache: {
        memory: true,
        strategy: 'background-revalidate',
        ttl: 0.001,
      },
      fetcher: async () => {
        fetchCount += 1;

        return Response.json({
          translations: {
            'welcome.title': `Bonjour ${fetchCount}`,
          },
        });
      },
    });

    await expect(loader.load({ locale: 'fr' }, { projectId: 'demo-project' })).resolves.toEqual({
      'welcome.title': 'Bonjour 1',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(loader.load({ locale: 'fr' }, { projectId: 'demo-project' })).resolves.toEqual({
      'welcome.title': 'Bonjour 1',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(loader.load({ locale: 'fr' }, { projectId: 'demo-project' })).resolves.toEqual({
      'welcome.title': 'Bonjour 2',
    });
  });

  it('loads locale resources through the local delivery helper', async () => {
    const loader = createLingvaLocalLoader<typeof resources>({
      path: '/tmp/lingva/{locale}.json',
      readFile: async (filePath) => {
        expect(filePath).toBe('/tmp/lingva/de.json');

        return JSON.stringify({
          resources: {
            'welcome.title': 'Willkommen lokal',
          },
        });
      },
    });

    const payload = await loader.load(
      {
        locale: 'de',
      },
      {}
    );

    expect(payload).toEqual({
      'welcome.title': 'Willkommen lokal',
    });
  });

  it('creates a client from runtime config and delivery settings', async () => {
    const project = defineLingvaProject({
      resources: {
        en: {},
      },
      defaultLocale: 'en',
      projectId: 'demo-project',
    });
    const client = createLingvaClientFromRuntimeConfig(
      {
        project,
        locale: 'fr',
        delivery: {
          mode: 'local',
          path: '/bundles/{locale}.json',
        },
      },
      {
        readFile: async (filePath) => {
          expect(filePath).toBe('/bundles/fr.json');

          return JSON.stringify({
            translations: {
              'welcome.title': 'Bonjour depuis config',
            },
          });
        },
      }
    );

    await expect(client.t('welcome.title')).resolves.toBe('Bonjour depuis config');
  });

  it('lets runtime refresh bypass delivery cache after invalidation', async () => {
    let readCount = 0;
    const client = createLingvaClientFromRuntimeConfig<typeof resources>(
      {
        locale: 'fr',
        delivery: {
          mode: 'local',
          path: '/bundles/{locale}.json',
          cache: {
            memory: true,
            ttl: 60,
          },
        },
      },
      {
        readFile: async () => {
          readCount += 1;

          return JSON.stringify({
            translations: {
              'welcome.title': `Bonjour local ${readCount}`,
            },
          });
        },
      }
    );

    await expect(client.t('welcome.title')).resolves.toBe('Bonjour local 1');
    await client.refresh('fr', ['welcome.title']);
    await expect(client.t('welcome.title')).resolves.toBe('Bonjour local 2');
    expect(readCount).toBe(2);
  });

  it('does not require readFile for local delivery when project resources already exist', async () => {
    const project = defineLingvaProject({
      resources: {
        en: {
          'welcome.title': 'Hello from generated project',
        },
        ru: {
          'welcome.title': 'Привет из generated project',
        },
      },
      defaultLocale: 'en',
      fallbackLocale: 'en',
      projectId: 'generated-project',
    });

    const client = createLingvaClientFromRuntimeConfig({
      project,
      locale: 'ru',
      delivery: {
        mode: 'local',
        path: '.lingva/translations/{locale}.json',
      },
    });

    await expect(client.t('welcome.title')).resolves.toBe('Привет из generated project');
  });

  it('infers translation variables from resource templates', () => {
    type ResourceMap = typeof resources;
    type WelcomeVariables = TranslationVariables<ResourceMap, 'welcome.message'>;
    type SummaryVariables = TranslationVariables<ResourceMap, 'dashboard.summary'>;

    expectTypeOf<WelcomeVariables>().toEqualTypeOf<{
      user: {
        name: string | number | boolean | null | undefined;
      };
    }>();

    expectTypeOf<SummaryVariables>().toEqualTypeOf<{
      count: string | number | boolean | null | undefined;
    }>();
  });

  it('preserves key and locale literals through createLingvaResources', () => {
    expectTypeOf<keyof typeof resources>().toEqualTypeOf<'en' | 'de'>();
    expectTypeOf<keyof (typeof resources)['en']>().toEqualTypeOf<
      'welcome.title' | 'welcome.message' | 'dashboard.summary'
    >();
  });

  it('infers dot-path keys from nested resources', () => {
    expectTypeOf<keyof typeof nestedResources>().toEqualTypeOf<'en' | 'ru'>();
    expectTypeOf<import('./contracts').TranslationKey<typeof nestedResources>>().toEqualTypeOf<
      'auth.signin.title' | 'auth.signin.subtitle'
    >();
    expectTypeOf<TranslationVariables<typeof nestedResources, 'auth.signin.subtitle'>>().toEqualTypeOf<{
      user: {
        name: string | number | boolean | null | undefined;
      };
    }>();
  });

  it('builds manifests from nested resources using dot-path keys', () => {
    const project = defineLingvaProject({
      resources: nestedResources,
      defaultLocale: 'en',
      fallbackLocale: 'en',
    });

    const manifest = createLingvaProjectManifest(project);

    expect(manifest.keys).toContain('auth.signin.title');
    expect(manifest.keys).toContain('auth.signin.subtitle');
  });

  it('creates a typed project contract with reusable client config', async () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'de',
      projectId: 'demo-project',
      keyMetadata: {
        'welcome.title': {
          description: 'Headline shown at the top of the welcome screen.',
          namespace: 'welcome',
          tags: ['marketing'],
        },
      },
    });

    const client = project.createClient({
      locale: 'de',
    });

    expect(project.getConfig().projectId).toBe('demo-project');
    await expect(client.t('welcome.title')).resolves.toBe('Willkommen zurueck');
    expect(project.getKeyMetadata('welcome.title')?.namespace).toBe('welcome');
    expect(project.getKeyMetadata('dashboard.summary')).toBeUndefined();
    expectTypeOf(project.defaultLocale).toEqualTypeOf<'en'>();
    expectTypeOf(project.fallbackLocale).toEqualTypeOf<'de' | undefined>();
  });

  it('validates project metadata and locale completeness', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'de',
      keyMetadata: {
        'welcome.title': {
          description: 'Welcome screen title.',
          namespace: 'welcome',
          status: 'approved',
          translator: 'translator@lingva.dev',
          reviewer: 'reviewer@lingva.dev',
        },
        'welcome.message': {
          description: '',
          namespace: 'marketing',
          status: 'reviewed',
        },
      },
    });

    const result = validateLingvaProject(project);

    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.infoCount).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.code === 'missing_key_metadata')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'missing_key_description')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'reviewed_key_missing_reviewer')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'translated_key_missing_translator')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'namespace_mismatch')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'missing_locale_translation')).toBe(true);
  });

  it('validates translation contract mismatches for variant resources', () => {
    const project = defineLingvaProject({
      defaultLocale: 'en',
      fallbackLocale: 'en',
      resources: createLingvaResources({
        en: {
          marketing: {
            hero: {
              title: [
                {
                  id: 'warm',
                  text: 'Welcome back, {user.name}.',
                },
                {
                  id: 'bold',
                  text: 'Ship it, {user.name}.',
                },
              ],
            },
          },
        },
        de: {
          marketing: {
            hero: {
              title: 'Willkommen zurueck',
            },
          },
        },
      }),
    });

    const result = validateLingvaProject(project);

    expect(result.issues.some((issue) => issue.code === 'translation_contract_mismatch')).toBe(true);
  });

  it('validates missing, extra, and metadata-mismatched locale variants', () => {
    const project = defineLingvaProject({
      defaultLocale: 'en',
      fallbackLocale: 'en',
      resources: createLingvaResources({
        en: {
          marketing: {
            hero: {
              title: [
                {
                  id: 'warm',
                  tone: 'warm',
                  text: 'Welcome back.',
                },
                {
                  id: 'bold',
                  tone: 'bold',
                  text: 'Ship faster.',
                },
              ],
            },
          },
        },
        de: {
          marketing: {
            hero: {
              title: [
                {
                  id: 'warm',
                  tone: 'formal',
                  text: 'Willkommen zurueck.',
                },
                {
                  id: 'playful',
                  tone: 'playful',
                  text: 'Los gehts.',
                },
              ],
            },
          },
        },
      }),
    });

    const result = validateLingvaProject(project);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_locale_variant',
          key: 'marketing.hero.title',
          locale: 'de',
        }),
        expect.objectContaining({
          code: 'extra_locale_variant',
          key: 'marketing.hero.title',
          locale: 'de',
        }),
        expect.objectContaining({
          code: 'variant_metadata_mismatch',
          key: 'marketing.hero.title',
          locale: 'de',
        }),
      ])
    );
  });

  it('formats validation results for text and json output', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      keyMetadata: {
        'welcome.title': {
          description: 'Welcome screen title.',
          namespace: 'welcome',
        },
      },
    });

    const result = validateLingvaProject(project);
    const textReport = formatLingvaValidationReport(result);
    const jsonReport = formatLingvaValidationReport(result, { format: 'json' });

    expect(textReport).toContain('Lingva validation: passed');
    expect(textReport).toContain('WARNING');
    expect(textReport).toContain('INFO');
    expect(() => JSON.parse(jsonReport)).not.toThrow();
    expect(JSON.parse(jsonReport).warningCount).toBe(result.warningCount);
  });

  it('creates a project manifest for codegen and automation flows', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'de',
      projectId: 'demo-project',
      keyMetadata: {
        'welcome.title': {
          description: 'Welcome screen title.',
          namespace: 'welcome',
        },
        'welcome.message': {
          description: 'Welcome screen greeting.',
          namespace: 'welcome',
        },
      },
    });

    const manifest = createLingvaProjectManifest(project);
    const welcomeMessageEntry = manifest.entries.find((entry) => entry.key === 'welcome.message');

    expect(manifest.projectId).toBe('demo-project');
    expect(manifest.locales).toEqual(['de', 'en']);
    expect(manifest.keys).toContain('dashboard.summary');
    expect(welcomeMessageEntry?.variables).toEqual(['user.name']);
    expect(welcomeMessageEntry?.translations.some((item) => item.locale === 'de' && item.missing === false)).toBe(true);
  });

  it('formats project manifests for text and json output', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      keyMetadata: {
        'welcome.title': {
          description: 'Welcome screen title.',
          namespace: 'welcome',
        },
      },
    });

    const manifest = createLingvaProjectManifest(project);
    const textManifest = formatLingvaProjectManifest(manifest, {
      format: 'text',
    });
    const jsonManifest = formatLingvaProjectManifest(manifest);

    expect(textManifest).toContain('Lingva manifest:');
    expect(textManifest).toContain('welcome.title');
    expect(textManifest).toContain('en [default]: Welcome back');
    expect(() => JSON.parse(jsonManifest)).not.toThrow();
    expect(JSON.parse(jsonManifest).entries).toHaveLength(manifest.entries.length);
  });

  it('creates a locale bundle artifact from project resources', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'de',
      projectId: 'demo-project',
      environment: 'stage',
      keyMetadata: {
        'welcome.message': {
          description: 'Welcome screen greeting.',
          namespace: 'welcome',
        },
      },
    });

    const bundle = createLingvaProjectBundle(project, {
      locale: 'fr',
      includeMetadata: true,
    });

    expect(bundle.projectId).toBe('demo-project');
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.environment).toBe('stage');
    expect(bundle.locale).toBe('fr');
    expect(bundle.messages['welcome.title']).toBe('Willkommen zurueck');
    expect(bundle.sources['welcome.title']).toBe('de');
    expect(bundle.fallbackKeys).toContain('welcome.title');
    expect(bundle.variables['welcome.message']).toEqual(['user.name']);
    expect(bundle.metadata?.['welcome.message']?.namespace).toBe('welcome');
  });

  it('keeps the native SDK fixture aligned with generated bundles', () => {
    const fixturePath = path.resolve(process.cwd(), '../../sdks/fixtures/en.bundle.json');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as LingvaProjectBundle;
    const project = defineLingvaProject({
      resources: {
        en: {
          actions: { continue: 'Continue' },
          welcome: {
            title: [
              { id: 'warm', text: 'Welcome, {name}.', tone: 'warm' },
              { id: 'bold', text: 'Ship it, {name}!', tone: 'direct' },
            ],
          },
        },
      },
      defaultLocale: 'en',
      fallbackLocale: 'en',
      projectId: 'native-demo',
      environment: 'dev',
    });
    const generated = createLingvaProjectBundle(project, { locale: 'en' });

    expect({ ...generated, generatedAt: fixture.generatedAt }).toEqual(fixture);
  });

  it('formats bundle artifacts for text and json output', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'de',
    });

    const bundle = createLingvaProjectBundle(project, {
      locale: 'fr',
    });
    const textBundle = formatLingvaProjectBundle(bundle, { format: 'text' });
    const jsonBundle = formatLingvaProjectBundle(bundle);

    expect(textBundle).toContain('Lingva bundle: locale=fr');
    expect(textBundle).toContain('welcome.title [from de fallback]');
    expect(() => JSON.parse(jsonBundle)).not.toThrow();
    expect(JSON.parse(jsonBundle).locale).toBe('fr');
  });

  it('includes raw variants in bundle artifacts while resolving a default runtime message', () => {
    const project = defineLingvaProject({
      resources: variantResources,
      defaultLocale: 'en',
      fallbackLocale: 'ru',
    });

    const bundle = createLingvaProjectBundle(project, {
      locale: 'en',
    });

    expect(bundle.messages['marketing.hero.title']).toBe('Welcome back, {user.name}.');
    expect(bundle.variants?.['marketing.hero.title']?.map((variant) => variant.id)).toEqual(['warm', 'bold']);
    expect(bundle.entries.find((entry) => entry.key === 'marketing.hero.title')?.variants?.length).toBe(2);
  });

  it('creates publish artifacts from project bundles', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'de',
      projectId: 'demo-project',
      environment: 'prod',
    });

    const artifacts = createLingvaPublishArtifacts(project, {
      locales: ['de', 'en'],
      includeMetadata: true,
    });

    expect(artifacts.manifest.projectId).toBe('demo-project');
    expect(artifacts.manifest.environment).toBe('prod');
    expect(artifacts.manifest.locales).toEqual(['de', 'en']);
    expect(artifacts.manifest.bundles[0]?.fileName).toBe('de.bundle.json');
    expect(artifacts.bundles.en.messages['welcome.title']).toBe('Welcome back');
  });

  it('rejects invalid translation keys during validation and publish artifact creation', () => {
    const invalidKey = 'a'.repeat(201);
    const project = defineLingvaProject({
      resources: { en: { [invalidKey]: 'Too long' } },
      defaultLocale: 'en',
      projectId: 'invalid-keys',
    });

    expect(validateLingvaProject(project).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid_translation_key',
          key: invalidKey,
          severity: 'error',
        }),
      ])
    );
    expect(() => createLingvaPublishArtifacts(project)).toThrow(/at most 200 characters/u);
  });

  it('formats publish artifacts for text and json output', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      fallbackLocale: 'de',
      projectId: 'demo-project',
    });

    const artifacts = createLingvaPublishArtifacts(project, {
      locales: ['de'],
    });
    const textArtifacts = formatLingvaPublishArtifacts(artifacts, {
      format: 'text',
    });
    const jsonArtifacts = formatLingvaPublishArtifacts(artifacts);

    expect(textArtifacts).toContain('Lingva publish artifacts: 1 locale bundle');
    expect(textArtifacts).toContain('de -> de.bundle.json');
    expect(() => JSON.parse(jsonArtifacts)).not.toThrow();
    expect(JSON.parse(jsonArtifacts).manifest.locales).toEqual(['de']);
  });

  it('summarizes collaboration workflow state from project metadata', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      keyMetadata: {
        'welcome.title': {
          description: 'Welcome screen title.',
          namespace: 'welcome',
          status: 'approved',
          translator: 'translator@lingva.dev',
          reviewer: 'reviewer@lingva.dev',
        },
        'welcome.message': {
          description: 'Welcome screen greeting.',
          namespace: 'welcome',
          status: 'translated',
          translator: 'translator@lingva.dev',
        },
        'dashboard.summary': {
          description: 'Dashboard summary copy.',
          namespace: 'dashboard',
          status: 'reviewed',
          translator: 'translator@lingva.dev',
        },
      },
    });

    const summary = createLingvaWorkflowSummary(project);
    const textReport = formatLingvaWorkflowSummary(summary, { format: 'text' });
    const jsonReport = formatLingvaWorkflowSummary(summary);

    expect(summary.statusCounts.approved).toBe(1);
    expect(summary.statusCounts.translated).toBe(1);
    expect(summary.statusCounts.reviewed).toBe(1);
    expect(summary.reviewerPendingKeys).toContain('dashboard.summary');
    expect(summary.approvalPendingKeys).toContain('dashboard.summary');
    expect(textReport).toContain('Lingva workflow: 3 key(s)');
    expect(textReport).toContain('Reviewer pending:');
    expect(() => JSON.parse(jsonReport)).not.toThrow();
    expect(JSON.parse(jsonReport).statusCounts.reviewed).toBe(1);
  });

  it('reports missing workflow status when metadata exists without status', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      keyMetadata: {
        'welcome.title': {
          description: 'Welcome screen title.',
          namespace: 'welcome',
        },
      },
    });

    const result = validateLingvaProject(project);

    expect(result.issues.some((issue) => issue.code === 'missing_workflow_status')).toBe(true);
  });

  it('formats a TypeScript module from the project manifest', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      keyMetadata: {
        'welcome.message': {
          description: 'Welcome screen greeting.',
          namespace: 'welcome',
        },
      },
    });

    const manifest = createLingvaProjectManifest(project);
    const moduleSource = formatLingvaProjectTypeScriptModule(manifest);

    expect(moduleSource).toContain('export const lingvaLocales');
    expect(moduleSource).toContain('export const lingvaKeys');
    expect(moduleSource).toContain('export const lingvaKeyVariables');
    expect(moduleSource).toContain('"welcome.message"');
    expect(moduleSource).toContain('"user.name"');
  });

  it('formats a helpers module from the project manifest', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      keyMetadata: {
        'welcome.message': {
          description: 'Welcome screen greeting.',
          namespace: 'welcome',
        },
      },
    });

    const manifest = createLingvaProjectManifest(project);
    const moduleSource = formatLingvaProjectHelpersModule(manifest);

    expect(moduleSource).toContain('export function isLingvaKey');
    expect(moduleSource).toContain('export function isLingvaLocale');
    expect(moduleSource).toContain('export function hasLingvaTranslation');
    expect(moduleSource).toContain('export function getLingvaVariables');
    expect(moduleSource).toContain('export function getLingvaKeyMetadata');
  });

  it('supports configurable failure thresholds for validation results', () => {
    const project = defineLingvaProject({
      resources,
      defaultLocale: 'en',
      keyMetadata: {
        'welcome.title': {
          description: 'Welcome screen title.',
          namespace: 'welcome',
        },
      },
    });

    const result = validateLingvaProject(project);

    expect(shouldFailLingvaValidation(result, 'none')).toBe(false);
    expect(shouldFailLingvaValidation(result, 'error')).toBe(false);
    expect(shouldFailLingvaValidation(result, 'warning')).toBe(true);
    expect(shouldFailLingvaValidation(result, 'info')).toBe(true);
  });

  it('supports a variant drift-only failure threshold for validation results', () => {
    const metadataOnlyResult = validateLingvaProject(
      defineLingvaProject({
        resources,
        defaultLocale: 'en',
      })
    );
    const variantDriftResult = validateLingvaProject(
      defineLingvaProject({
        defaultLocale: 'en',
        fallbackLocale: 'en',
        resources: createLingvaResources({
          en: {
            hero: {
              title: [
                {
                  id: 'warm',
                  tone: 'warm',
                  text: 'Welcome.',
                },
              ],
            },
          },
          de: {
            hero: {
              title: [
                {
                  id: 'warm',
                  tone: 'formal',
                  text: 'Willkommen.',
                },
              ],
            },
          },
        }),
      })
    );

    expect(shouldFailLingvaValidation(metadataOnlyResult, 'variant-drift')).toBe(false);
    expect(shouldFailLingvaValidation(variantDriftResult, 'variant-drift')).toBe(true);
  });
});
