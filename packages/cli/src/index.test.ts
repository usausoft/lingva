import assert from 'node:assert/strict';

import test from 'node:test';

import fs from 'node:fs/promises';

import os from 'node:os';

import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import {
  applyLingvaLocalDictionary,
  approveLingvaDraft,
  checkLingvaLocalProject,
  checkLingvaCliUpdate,
  clearLingvaCliCredentials,
  createLingvaInitScaffold,
  discoverLingvaCliAuthConfig,
  exchangeLingvaAuthCodeForCredentials,
  generateLingvaStudio,
  getLingvaCliAuthStatus,
  getLingvaCliCredentialsAuthToken,
  initializeLingvaProject,
  listHostedLingvaDrafts,
  listLingvaCliPlatformProjects,
  loadLingvaRuntimeConfig,
  loadLingvaCliCredentials,
  pollLingvaDeviceCredentials,
  pullLingvaBundles,
  pushLingvaProject,
  requestLingvaDeviceAuthorization,
  refreshLingvaCliCredentials,
  resolveLingvaCliAuthConfig,
  resolveLingvaCliConfigFile,
  resolveLingvaCliPublishOptions,
  resolveLingvaCliStoredAuthToken,
  saveLingvaCliApiKeyCredentials,
  saveLingvaCliCredentials,
  scaffoldLingvaMetadata,
  syncLingvaLocalFiles,
  validateLingvaProjectFile,
} from './index';

test('resolveLingvaCliConfigFile prefers the root YAML config when no path is provided', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-default-config-'));
  const yamlConfig = path.join(cwd, 'lingva.config.yaml');

  await Promise.all([
    fs.writeFile(yamlConfig, 'projectId: portable-project\n', 'utf8'),
    fs.writeFile(path.join(cwd, 'lingva.config.ts'), 'export default {};\n', 'utf8'),
  ]);

  assert.equal(await resolveLingvaCliConfigFile(cwd), yamlConfig);
});

test('loadLingvaRuntimeConfig keeps JSON config compatibility', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-json-config-'));
  const configFile = path.join(cwd, 'lingva.config.json');
  const config = {
    projectId: 'python-service',
    environment: 'stage',
    locales: ['en', 'de'],
    defaultLocale: 'en',
    fallbackLocale: 'en',
    translationFiles: '.lingva/translations/{locale}.json',
  };

  await fs.writeFile(configFile, JSON.stringify(config), 'utf8');

  const loaded = await loadLingvaRuntimeConfig(configFile);

  assert.deepEqual(loaded.config, config);
  assert.equal(loaded.configFile, configFile);
});

test('portable apiUrl configures hosted publish without duplicated CLI config', () => {
  const previousApiKey = process.env.LINGVA_API_KEY;
  process.env.LINGVA_API_KEY = 'project-key';

  try {
    assert.deepEqual(
      resolveLingvaCliPublishOptions(
        { apiUrl: 'https://publish.example.test', apiKeyEnv: 'LINGVA_API_KEY' },
        { locales: ['en'] }
      ),
      {
        apiUrl: 'https://publish.example.test',
        authToken: 'project-key',
        locales: ['en'],
      }
    );
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.LINGVA_API_KEY;
    } else {
      process.env.LINGVA_API_KEY = previousApiKey;
    }
  }
});

test('pullLingvaBundles downloads hosted translations through the portable contract', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-hosted-pull-'));
  const configFile = path.join(cwd, 'lingva.config.yaml');
  const originalFetch = globalThis.fetch;
  let request: { url?: string; authorization?: string; apiKey?: string } = {};

  await fs.writeFile(
    configFile,
    [
      'projectId: python-service',
      'apiUrl: https://publish.example.test/',
      'environment: stage',
      'locales:',
      '  - en',
      '  - de',
      'defaultLocale: en',
      'fallbackLocale: en',
      'translationFiles: .lingva/translations/{locale}.json',
      '',
    ].join('\n'),
    'utf8'
  );

  globalThis.fetch = (async (input, init) => {
    const headers = new Headers(init?.headers);
    request = {
      url: String(input),
      authorization: headers.get('authorization') ?? undefined,
      apiKey: headers.get('x-api-key') ?? undefined,
    };

    return new Response(
      JSON.stringify({
        schemaVersion: 1,
        projectId: 'python-service',
        environment: 'stage',
        locale: 'de',
        defaultLocale: 'en',
        fallbackLocale: 'en',
        generatedAt: '2026-10-07T00:00:00.000Z',
        keyCount: 2,
        fallbackKeys: ['actions.cancel'],
        messages: {
          'actions.save': 'Speichern',
          'actions.cancel': 'Cancel',
        },
        sources: {
          'actions.save': 'de',
          'actions.cancel': 'en',
        },
        variables: {
          'actions.save': [],
          'actions.cancel': [],
        },
        entries: [],
      }),
      { status: 200, headers: { 'content-type': 'application/json', 'x-lingva-revision': 'publish_1' } }
    );
  }) as typeof fetch;

  try {
    const result = await pullLingvaBundles(configFile, {
      locales: ['de'],
      authToken: 'project-key',
    });
    const german = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/de.json'), 'utf8')) as Record<
      string,
      unknown
    >;

    assert.equal(result.mode, 'remote');
    assert.equal(request.url, 'https://publish.example.test/bundles/python-service/stage/latest/de.bundle.json');
    assert.equal(request.authorization, 'Bearer project-key');
    assert.equal(request.apiKey, 'project-key');
    assert.deepEqual(german, { actions: { save: 'Speichern' } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('pullLingvaBundles rejects same-key conflicts without overwriting local changes', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-hosted-pull-conflict-'));
  const configFile = path.join(cwd, 'lingva.config.yaml');
  const translationFile = path.join(cwd, '.lingva/translations/en.json');
  const originalFetch = globalThis.fetch;
  let remoteValue = 'Initial';
  let revision = 'publish_1';

  await fs.writeFile(
    configFile,
    [
      'projectId: conflict-service',
      'apiUrl: https://publish.example.test/',
      'environment: stage',
      'locales: [en]',
      'defaultLocale: en',
      'translationFiles: .lingva/translations/{locale}.json',
      '',
    ].join('\n'),
    'utf8'
  );
  globalThis.fetch = (async () =>
    Response.json(
      {
        schemaVersion: 1,
        locale: 'en',
        messages: { title: remoteValue },
        sources: { title: 'en' },
      },
      { headers: { 'x-lingva-revision': revision } }
    )) as typeof fetch;

  try {
    await pullLingvaBundles(configFile);
    await fs.writeFile(translationFile, '{"title":"Local"}\n', 'utf8');
    remoteValue = 'Remote';
    revision = 'publish_2';

    await assert.rejects(pullLingvaBundles(configFile), /conflicts in locale "en": title/u);
    assert.deepEqual(JSON.parse(await fs.readFile(translationFile, 'utf8')), { title: 'Local' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createLingvaInitScaffold creates local-mode files', () => {
  const scaffold = createLingvaInitScaffold({
    mode: 'local',
    projectId: 'marketing-site',
    locales: ['en', 'de'],
    translationFiles: '.lingva/translations/{locale}.json',
  });

  assert.equal(scaffold.mode, 'local');
  assert.equal(scaffold.files[0]?.path, 'lingva.config.ts');
  assert.match(scaffold.files[0]?.content ?? '', /translationFiles/);
  assert.match(scaffold.files[0]?.content ?? '', /generatedProjectFile/);
  assert.equal(scaffold.files[1]?.path, '.lingva/translations/en.json');
  assert.equal(scaffold.files[2]?.path, '.lingva/translations/de.json');
  assert.equal(scaffold.files[3]?.path, '.lingva/generated/project.ts');
  assert.equal(scaffold.files[4]?.path, '.lingva/metadata.json');
  assert.equal(scaffold.files[5]?.path, '.lingva/README.md');
  assert.match(scaffold.files[0]?.content ?? '', /metadataFile: '\.lingva\/metadata\.json'/);
  assert.match(scaffold.files[5]?.content ?? '', /lingva metadata lingva\.config\.ts --check/);
  assert.match(scaffold.files[5]?.content ?? '', /lingva check lingva\.config\.ts/);
});

test('createLingvaInitScaffold creates the portable YAML config for non-JavaScript consumers', () => {
  const scaffold = createLingvaInitScaffold({
    configFile: 'lingva.config.yaml',
    projectId: 'python-service',
    environment: 'stage',
    locales: ['en', 'de'],
    apiUrl: 'https://publish.example.test',
  });
  const config = parseYaml(scaffold.files[0]?.content ?? '') as Record<string, unknown>;

  assert.deepEqual(config, {
    projectId: 'python-service',
    environment: 'stage',
    locales: ['en', 'de'],
    defaultLocale: 'en',
    fallbackLocale: 'en',
    translationFiles: '.lingva/translations/{locale}.json',
    generatedProjectFile: '.lingva/generated/project.ts',
    metadataFile: '.lingva/metadata.json',
    apiUrl: 'https://publish.example.test',
    apiKeyEnv: 'LINGVA_API_KEY',
  });
});

test('createLingvaInitScaffold can add a GitHub Actions local-mode workflow', () => {
  const scaffold = createLingvaInitScaffold({
    mode: 'local',
    ci: 'github',
    configFile: 'config/lingva.config.ts',
  });
  const workflow = scaffold.files.find((file) => file.path === '.github/workflows/lingva-local.yml');

  assert.equal(scaffold.ci, 'github');
  assert.ok(workflow);
  assert.match(workflow.content, /name: Lingva Local Checks/);
  assert.match(workflow.content, /uses: actions\/checkout@v6/);
  assert.match(workflow.content, /uses: pnpm\/action-setup@v6/);
  assert.match(workflow.content, /uses: actions\/setup-node@v6/);
  assert.match(workflow.content, /node-version: 24/);
  assert.match(workflow.content, /pnpm lingva metadata config\/lingva\.config\.ts --check/);
  assert.match(workflow.content, /pnpm lingva check config\/lingva\.config\.ts/);
});

test('createLingvaInitScaffold rejects GitHub CI for remote-mode projects', () => {
  assert.throws(
    () =>
      createLingvaInitScaffold({
        mode: 'remote',
        ci: 'github',
      }),
    /supports local mode only/
  );
});

test('hosted React starter documents the real local-to-hosted product path', async () => {
  const starterRoot = new URL('../../../examples/hosted-react-starter/', import.meta.url);
  const readStarterFile = (file: string) => fs.readFile(new URL(file, starterRoot), 'utf8');
  const [readme, packageJson, lingvaConfig, provider, app, enRaw, ruRaw] = await Promise.all([
    readStarterFile('README.md'),
    readStarterFile('package.json'),
    readStarterFile('lingva.config.ts'),
    readStarterFile('src/lingva/provider.tsx'),
    readStarterFile('src/App.tsx'),
    readStarterFile('.lingva/translations/en.json'),
    readStarterFile('.lingva/translations/ru.json'),
  ]);

  assert.match(readme, /lingva auth login/);
  assert.match(readme, /pnpm lingva check/);
  assert.match(readme, /pnpm lingva push/);
  assert.match(packageJson, /verify:starter/);
  assert.match(packageJson, /--api-url/);
  assert.doesNotMatch(packageJson, /--publish-api-url/);
  assert.doesNotMatch(packageJson, /--invalidation-api-url/);
  assert.match(lingvaConfig, /translationFiles/);
  assert.match(lingvaConfig, /deliveryMode === STARTER_DELIVERY_MODES\.hosted/);
  assert.match(lingvaConfig, /mode:\s*LINGVA_DELIVERY_MODES\.cdn,\s*url:\s*bundleUrl/u);
  assert.match(lingvaConfig, /mode:\s*LINGVA_DELIVERY_MODES\.local,\s*path:/u);
  assert.match(provider, /configureLingvaReact/);
  assert.match(provider, /LingvaProvider/);
  assert.match(app, /LingvaText/);

  const flatten = (value: unknown, prefix = ''): string[] =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key))
      : [prefix];
  const enKeys = flatten(JSON.parse(enRaw)).sort();
  const ruKeys = flatten(JSON.parse(ruRaw)).sort();

  assert.deepEqual(ruKeys, enKeys);
});

test('resolveLingvaCliAuthConfig supports issuer-based OAuth endpoints', () => {
  assert.deepEqual(
    resolveLingvaCliAuthConfig({
      environment: {
        LINGVA_AUTH_CLIENT_ID: 'lingva-cli',
        LINGVA_AUTH_ISSUER_URL: 'https://auth.example.com/',
        LINGVA_AUTH_SCOPES: 'openid profile',
      },
    }),
    {
      authorizeUrl: 'https://auth.example.com/oauth2/authorize',
      clientId: 'lingva-cli',
      deviceUrl: 'https://auth.example.com/oauth2/device_authorization',
      scopes: ['openid', 'profile'],
      tokenUrl: 'https://auth.example.com/oauth2/token',
    }
  );
});

test('discoverLingvaCliAuthConfig resolves environment-specific OAuth metadata', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), 'https://stage.lingva.dev/api/cli/config');
    return Response.json({
      clientId: 'stage-cli',
      issuerUrl: 'https://stage-auth.example',
      platformUrl: 'https://stage.lingva.dev',
    });
  };

  try {
    assert.deepEqual(await discoverLingvaCliAuthConfig('https://stage.lingva.dev/'), {
      clientId: 'stage-cli',
      issuerUrl: 'https://stage-auth.example',
      platformUrl: 'https://stage.lingva.dev',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('listLingvaCliPlatformProjects authenticates project discovery with OAuth bearer', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://stage.lingva.dev/api/cli/projects');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer oauth-token');
    return Response.json({
      projects: [
        { projectId: 'python-app', name: 'Python app', locales: ['en'], defaultLocale: 'en', environments: [] },
      ],
    });
  };

  try {
    const projects = await listLingvaCliPlatformProjects({
      accessToken: 'oauth-token',
      platformUrl: 'https://stage.lingva.dev',
    });
    assert.equal(projects[0]?.projectId, 'python-app');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkLingvaCliUpdate reports the exact pnpm upgrade command', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), 'https://registry.npmjs.org/@lingva%2fcli/latest');
    return Response.json({ version: '0.2.0' });
  };

  try {
    const result = await checkLingvaCliUpdate({ currentVersion: '0.1.0' });
    assert.equal(result.updateAvailable, true);
    assert.equal(result.installCommand, 'pnpm add --save-dev @lingva/cli@latest');
    assert.match(result.report, /0\.1\.0 -> 0\.2\.0/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Lingva CLI credentials are stored and reported from the local auth store', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-auth-store-'));
  const credentialsFile = path.join(cwd, 'credentials.json');

  await saveLingvaCliCredentials(
    {
      accessToken: 'access-token',
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      obtainedAt: new Date().toISOString(),
      tokenType: 'Bearer',
    },
    credentialsFile
  );

  const credentials = await loadLingvaCliCredentials(credentialsFile);
  const status = await getLingvaCliAuthStatus(credentialsFile);

  assert.equal(credentials?.accessToken, 'access-token');
  assert.equal(getLingvaCliCredentialsAuthToken(credentials), 'access-token');
  assert.equal(status.authenticated, true);
  assert.match(status.report, /authenticated/);

  await clearLingvaCliCredentials(credentialsFile);
  assert.equal(await loadLingvaCliCredentials(credentialsFile), null);
});

test('Lingva CLI can store a project API key for hosted commands', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-auth-api-key-'));
  const credentialsFile = path.join(cwd, 'credentials.json');

  const result = await saveLingvaCliApiKeyCredentials({
    apiKey: 'lvk_test_1234567890abcdef',
    credentialsFile,
    projectId: 'dashboard',
  });
  const credentials = await loadLingvaCliCredentials(credentialsFile);
  const status = await getLingvaCliAuthStatus(credentialsFile);

  assert.equal(result.apiKeyPreview, 'lvk_test...cdef');
  assert.equal(credentials?.apiKey, 'lvk_test_1234567890abcdef');
  assert.equal(credentials?.projectId, 'dashboard');
  assert.equal(getLingvaCliCredentialsAuthToken(credentials), 'lvk_test_1234567890abcdef');
  assert.equal(status.authenticated, true);
  assert.equal(status.authMethod, 'api-key');
  assert.equal(status.projectId, 'dashboard');
  assert.match(status.report, /method: api-key/);
  assert.match(status.report, /key: lvk_test\.\.\.cdef/);
});

test('exchangeLingvaAuthCodeForCredentials uses OAuth PKCE token exchange', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];

  globalThis.fetch = (async (url, init) => {
    requests.push({
      url: String(url),
      body: String(init?.body),
    });

    return new Response(
      JSON.stringify({
        access_token: 'access-token',
        expires_in: 3600,
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }
    );
  }) as typeof fetch;

  const credentials = await exchangeLingvaAuthCodeForCredentials({
    clientId: 'lingva-cli',
    code: 'auth-code',
    codeVerifier: 'verifier',
    redirectUri: 'http://127.0.0.1:4000/callback',
    tokenUrl: 'https://auth.example.com/oauth2/token',
  });

  assert.equal(credentials.accessToken, 'access-token');
  assert.equal(credentials.refreshToken, 'refresh-token');
  assert.equal(requests[0]?.url, 'https://auth.example.com/oauth2/token');
  assert.match(requests[0]?.body ?? '', /grant_type=authorization_code/);
  assert.match(requests[0]?.body ?? '', /code_verifier=verifier/);

  globalThis.fetch = originalFetch;
});

test('refreshLingvaCliCredentials exchanges refresh tokens for new access tokens', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];

  globalThis.fetch = (async (url, init) => {
    requests.push({
      url: String(url),
      body: String(init?.body),
    });

    return new Response(
      JSON.stringify({
        access_token: 'new-access-token',
        expires_in: 7200,
        token_type: 'Bearer',
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }
    );
  }) as typeof fetch;

  const credentials = await refreshLingvaCliCredentials({
    clientId: 'lingva-cli',
    credentials: {
      accessToken: 'old-access-token',
      obtainedAt: new Date(Date.now() - 7_200_000).toISOString(),
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
    },
    tokenUrl: 'https://auth.example.com/oauth2/token',
  });

  assert.equal(credentials.accessToken, 'new-access-token');
  assert.equal(credentials.refreshToken, 'refresh-token');
  assert.equal(credentials.clientId, 'lingva-cli');
  assert.equal(credentials.tokenUrl, 'https://auth.example.com/oauth2/token');
  assert.match(requests[0]?.body ?? '', /grant_type=refresh_token/);
  assert.match(requests[0]?.body ?? '', /refresh_token=refresh-token/);

  globalThis.fetch = originalFetch;
});

test('requestLingvaDeviceAuthorization starts OAuth device login', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];

  globalThis.fetch = (async (url, init) => {
    requests.push({
      url: String(url),
      body: String(init?.body),
    });

    return new Response(
      JSON.stringify({
        device_code: 'device-code',
        expires_in: 600,
        interval: 1,
        user_code: 'ABCD-EFGH',
        verification_uri: 'https://auth.example.com/device',
        verification_uri_complete: 'https://auth.example.com/device?user_code=ABCD-EFGH',
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }
    );
  }) as typeof fetch;

  await assert.doesNotReject(async () => {
    assert.deepEqual(
      await requestLingvaDeviceAuthorization({
        clientId: 'lingva-cli',
        deviceUrl: 'https://auth.example.com/oauth2/device_authorization',
        scopes: ['openid', 'profile'],
      }),
      {
        deviceCode: 'device-code',
        expiresIn: 600,
        interval: 1,
        userCode: 'ABCD-EFGH',
        verificationUri: 'https://auth.example.com/device',
        verificationUriComplete: 'https://auth.example.com/device?user_code=ABCD-EFGH',
      }
    );
  });

  assert.equal(requests[0]?.url, 'https://auth.example.com/oauth2/device_authorization');
  assert.match(requests[0]?.body ?? '', /client_id=lingva-cli/);

  globalThis.fetch = originalFetch;
});

test('pollLingvaDeviceCredentials waits for approval and returns credentials', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;

  globalThis.fetch = (async () => {
    attempts += 1;

    if (attempts === 1) {
      return new Response(JSON.stringify({ error: 'authorization_pending' }), {
        headers: { 'content-type': 'application/json' },
        status: 400,
      });
    }

    return new Response(
      JSON.stringify({
        access_token: 'device-access-token',
        expires_in: 3600,
        refresh_token: 'device-refresh-token',
        token_type: 'Bearer',
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }
    );
  }) as typeof fetch;

  const credentials = await pollLingvaDeviceCredentials({
    clientId: 'lingva-cli',
    deviceCode: 'device-code',
    expiresIn: 5,
    interval: 0.001,
    tokenUrl: 'https://auth.example.com/oauth2/token',
  });

  assert.equal(credentials.accessToken, 'device-access-token');
  assert.equal(credentials.refreshToken, 'device-refresh-token');
  assert.equal(credentials.clientId, 'lingva-cli');
  assert.equal(credentials.tokenUrl, 'https://auth.example.com/oauth2/token');
  assert.equal(attempts, 2);

  globalThis.fetch = originalFetch;
});

test('resolveLingvaCliStoredAuthToken refreshes expired stored credentials', async () => {
  const originalFetch = globalThis.fetch;
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-auth-refresh-'));
  const credentialsFile = path.join(cwd, 'credentials.json');

  await saveLingvaCliCredentials(
    {
      accessToken: 'expired-access-token',
      clientId: 'lingva-cli',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      obtainedAt: new Date(Date.now() - 3_600_000).toISOString(),
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      tokenUrl: 'https://auth.example.com/oauth2/token',
    },
    credentialsFile
  );

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        access_token: 'refreshed-access-token',
        expires_in: 3600,
        refresh_token: 'rotated-refresh-token',
        token_type: 'Bearer',
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }
    )) as typeof fetch;

  await assert.doesNotReject(async () => {
    assert.equal(await resolveLingvaCliStoredAuthToken({ credentialsFile }), 'refreshed-access-token');
  });

  const credentials = await loadLingvaCliCredentials(credentialsFile);

  assert.equal(credentials?.accessToken, 'refreshed-access-token');
  assert.equal(credentials?.refreshToken, 'rotated-refresh-token');

  globalThis.fetch = originalFetch;
});

test('createLingvaInitScaffold adds a React provider when requested', () => {
  const scaffold = createLingvaInitScaffold({
    mode: 'local',
    framework: 'react',
    configFile: 'lingva.config.ts',
    providerFile: 'src/lingva/provider.tsx',
  });

  const providerFile = scaffold.files.find((file) => file.path === 'src/lingva/provider.tsx');

  assert.equal(scaffold.framework, 'react');
  assert.ok(providerFile);
  assert.match(providerFile?.content ?? '', /import \{ configureLingvaReact, LingvaProvider \} from '@lingva\/react'/);
  assert.match(providerFile?.content ?? '', /import lingvaConfig from '\.\.\/\.\.\/lingva\.config'/);
  assert.match(providerFile?.content ?? '', /import lingvaProject from '\.\.\/\.\.\/\.lingva\/generated\/project'/);
  assert.match(providerFile?.content ?? '', /configureLingvaReact\(\{/);
  assert.match(providerFile?.content ?? '', /AppLingvaProvider/);
});

test('createLingvaInitScaffold adds a Next.js provider when requested', () => {
  const scaffold = createLingvaInitScaffold({
    mode: 'local',
    framework: 'next',
    configFile: 'lingva.config.ts',
    providerFile: 'src/lingva/provider.tsx',
  });

  const providerFile = scaffold.files.find((file) => file.path === 'src/lingva/provider.tsx');

  assert.equal(scaffold.framework, 'next');
  assert.ok(providerFile);
  assert.match(providerFile?.content ?? '', /import \{ createLingvaNextProvider \} from '@lingva\/next'/);
  assert.match(providerFile?.content ?? '', /import lingvaConfig from '\.\.\/\.\.\/lingva\.config'/);
  assert.match(providerFile?.content ?? '', /import lingvaProject from '\.\.\/\.\.\/\.lingva\/generated\/project'/);
  assert.match(providerFile?.content ?? '', /project: lingvaProject/);
  assert.match(providerFile?.content ?? '', /displayName: 'AppLingvaProvider'/);
});

test('createLingvaInitScaffold adds framework-native Angular, Vue, and Svelte bootstraps', () => {
  const cases = [
    {
      framework: 'angular' as const,
      path: 'src/lingva/providers.ts',
      packageName: '@lingva/angular',
      api: 'provideLingvaAngular',
    },
    {
      framework: 'vue' as const,
      path: 'src/lingva/index.ts',
      packageName: '@lingva/vue',
      api: 'createLingvaVue',
    },
    {
      framework: 'svelte' as const,
      path: 'src/lib/lingva.ts',
      packageName: '@lingva/svelte',
      api: 'createLingvaSvelte',
    },
  ];

  for (const entry of cases) {
    const scaffold = createLingvaInitScaffold({ framework: entry.framework, mode: 'local' });
    const bootstrap = scaffold.files.find((file) => file.path === entry.path);

    assert.ok(bootstrap, `${entry.framework} bootstrap should be generated`);
    assert.match(bootstrap.content, new RegExp(entry.packageName.replace('/', '\\/')));
    assert.match(bootstrap.content, new RegExp(entry.api));
    assert.match(bootstrap.content, /\.lingva\/generated\/project/);
    assert.match(bootstrap.content, /project: lingvaProject/);
  }
});

test('framework bootstraps omit generated local resources in remote mode', () => {
  for (const framework of ['angular', 'vue', 'svelte'] as const) {
    const scaffold = createLingvaInitScaffold({
      apiUrl: 'https://publish.example.test',
      framework,
      mode: 'remote',
    });
    const bootstrap = scaffold.files.at(-1);

    assert.ok(bootstrap);
    assert.doesNotMatch(bootstrap.content, /\.lingva\/generated\/project/);
    assert.match(bootstrap.content, /lingvaConfig/);
  }
});

test('vanilla framework selection keeps runtime setup explicit without generating a wrapper', () => {
  const scaffold = createLingvaInitScaffold({ framework: 'vanilla', mode: 'local' });

  assert.equal(scaffold.framework, 'vanilla');
  assert.equal(
    scaffold.files.some((file) => file.path.startsWith('src/')),
    false
  );
});

test('createLingvaInitScaffold does not import generated local project in remote provider scaffolds', () => {
  const scaffold = createLingvaInitScaffold({
    apiUrl: 'https://publish.example.test',
    mode: 'remote',
    framework: 'react',
  });

  const providerFile = scaffold.files.find((file) => file.path === 'src/lingva/provider.tsx');

  assert.ok(providerFile);
  assert.doesNotMatch(providerFile?.content ?? '', /\.lingva\/generated\/project/);
  assert.match(providerFile?.content ?? '', /configureLingvaReact\(lingvaConfig\)/);
});

test('createLingvaInitScaffold creates remote-mode config', () => {
  const scaffold = createLingvaInitScaffold({
    mode: 'remote',
    projectId: 'dashboard',
    environment: 'stage',
    locales: ['en', 'ru'],
    apiUrl: 'https://api.example.com',
    bundleUrl: 'https://delivery.example.com/bundles/dashboard/stage/latest/{locale}.bundle.json',
    apiKeyEnv: 'APP_LINGVA_KEY',
  });

  assert.equal(scaffold.mode, 'remote');
  assert.equal(scaffold.files.length, 2);
  assert.match(scaffold.files[0]?.content ?? '', /mode: 'cdn'/);
  assert.match(scaffold.files[0]?.content ?? '', /environment: 'stage'/);
  assert.match(scaffold.files[0]?.content ?? '', /locales: \['en', 'ru'\]/);
  assert.match(
    scaffold.files[0]?.content ?? '',
    /delivery\.example\.com\/bundles\/dashboard\/stage\/latest\/\{locale\}\.bundle\.json/
  );
  assert.match(scaffold.files[0]?.content ?? '', /process\.env\.APP_LINGVA_KEY/);
  assert.equal(scaffold.files[1]?.path, '.lingva/.gitignore');
  assert.equal(scaffold.files[1]?.content, 'remote-state.json\n');
});

test('createLingvaInitScaffold creates a portable config for the Python SDK', () => {
  const scaffold = createLingvaInitScaffold({
    apiUrl: 'https://publish.example.test',
    mode: 'remote',
    projectId: 'python-app',
    sdk: 'python',
  });

  assert.equal(scaffold.sdk, 'python');
  assert.equal(scaffold.configFile, 'lingva.config.yaml');
  assert.match(scaffold.files[0]?.content ?? '', /projectId: python-app/);
});

test('createLingvaInitScaffold keeps local Python setup language-neutral', () => {
  const scaffold = createLingvaInitScaffold({ mode: 'local', sdk: 'python' });

  assert.equal(scaffold.configFile, 'lingva.config.yaml');
  assert.equal(
    scaffold.files.some((file) => file.path.endsWith('.ts')),
    false
  );
  assert.equal(
    scaffold.files.some((file) => file.path === '.lingva/metadata.json'),
    false
  );
});

test('createLingvaInitScaffold safely renders non-identifier api key env names', () => {
  const scaffold = createLingvaInitScaffold({
    apiUrl: 'https://publish.example.test',
    mode: 'remote',
    apiKeyEnv: 'APP-LINGVA-KEY',
  });

  assert.match(scaffold.files[0]?.content ?? '', /process\.env\['APP-LINGVA-KEY'\]/);
});

test('createLingvaInitScaffold requires the project publish API URL in remote mode', () => {
  assert.throws(
    () => createLingvaInitScaffold({ mode: 'remote' }),
    /Copy the publish API URL from the environment in your Lingva project setup page/
  );
});

test('createLingvaInitScaffold defaults remote delivery to the hosted current-bundle route', () => {
  const scaffold = createLingvaInitScaffold({
    mode: 'remote',
    apiUrl: 'https://delivery.example.com/',
  });

  assert.match(
    scaffold.files[0]?.content ?? '',
    /delivery\.example\.com\/bundles\/\{projectId\}\/\{environment\}\/latest\/\{locale\}\.bundle\.json/
  );
});

test('initializeLingvaProject writes files to disk', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-init-'));

  const result = await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  assert.equal(result.written, true);
  assert.ok(result.nextSteps.some((step) => step.includes('pnpm lingva sync lingva.config.ts')));
  assert.ok(result.nextSteps.some((step) => step.includes('pnpm lingva metadata lingva.config.ts --check')));
  assert.ok(result.nextSteps.some((step) => step.includes('pnpm lingva check lingva.config.ts')));

  const configFile = await fs.readFile(path.join(cwd, 'lingva.config.ts'), 'utf8');
  const enFile = await fs.readFile(path.join(cwd, '.lingva/translations/en.json'), 'utf8');
  const generatedFile = await fs.readFile(path.join(cwd, '.lingva/generated/project.ts'), 'utf8');
  const metadataFile = await fs.readFile(path.join(cwd, '.lingva/metadata.json'), 'utf8');
  const workflowReadme = await fs.readFile(path.join(cwd, '.lingva/README.md'), 'utf8');

  assert.match(configFile, /translationFiles/);
  assert.match(configFile, /metadataFile: '\.lingva\/metadata\.json'/);
  assert.match(enFile, /Welcome to Lingva/);
  assert.match(generatedFile, /defineLingvaProject/);
  assert.match(generatedFile, /keyMetadata/);
  assert.match(generatedFile, /\.\.\/translations\/en\.json/);
  assert.match(metadataFile, /TODO: Describe \\"common\.welcome\\"/);
  assert.match(workflowReadme, /Recommended CI guards/);
  assert.match(workflowReadme, /lingva metadata lingva\.config\.ts --check/);
  assert.match(workflowReadme, /lingva check lingva\.config\.ts/);
  assert.match(result.report, /Next steps:/);
  assert.match(result.report, /pnpm lingva sync lingva\.config\.ts/);
});

test('initializeLingvaProject writes React provider scaffold when requested', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-init-react-'));

  const result = await initializeLingvaProject({
    cwd,
    mode: 'local',
    framework: 'react',
  });

  assert.equal(result.framework, 'react');
  assert.ok(result.nextSteps.some((step) => step.includes('AppLingvaProvider')));

  const providerFile = await fs.readFile(path.join(cwd, 'src/lingva/provider.tsx'), 'utf8');

  assert.match(providerFile, /AppLingvaProvider/);
  assert.match(providerFile, /configureLingvaReact/);
  assert.match(providerFile, /project: lingvaProject/);
});

test('initializeLingvaProject writes Next.js provider scaffold when requested', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-init-next-'));

  const result = await initializeLingvaProject({
    cwd,
    mode: 'local',
    framework: 'next',
  });

  assert.equal(result.framework, 'next');
  assert.ok(result.nextSteps.some((step) => step.includes('app/layout.tsx')));

  const providerFile = await fs.readFile(path.join(cwd, 'src/lingva/provider.tsx'), 'utf8');

  assert.match(providerFile, /createLingvaNextProvider/);
  assert.match(providerFile, /project: lingvaProject/);
});

test('initializeLingvaProject supports dry-run without writing files', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-init-dry-'));

  const result = await initializeLingvaProject({
    apiUrl: 'https://publish.example.test',
    cwd,
    mode: 'remote',
    dryRun: true,
    format: 'json',
  });

  assert.equal(result.written, false);
  await assert.rejects(fs.stat(path.join(cwd, 'lingva.config.ts')));
  const report = JSON.parse(result.report) as { nextSteps?: string[] };

  assert.ok(report.nextSteps?.some((step) => step.includes('LINGVA_API_KEY')));
  assert.ok(report.nextSteps?.some((step) => step.includes('lingva auth login')));
  assert.ok(report.nextSteps?.some((step) => step.includes('lingva pull lingva.config.ts')));
  assert.ok(report.nextSteps?.every((step) => !step.includes('sync hosted state')));
});

test('syncLingvaLocalFiles adds missing keys without overwriting existing translations', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-sync-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/ru.json'),
    JSON.stringify(
      {
        common: {
          appName: 'Приложение Lingva',
        },
      },
      null,
      2
    )
  );

  const result = await syncLingvaLocalFiles(path.join(cwd, 'lingva.config.ts'));
  const ruFile = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8')) as {
    common?: { appName?: string; welcome?: string };
    auth?: { signIn?: { title?: string; subtitle?: string } };
  };

  assert.equal(result.locales.includes('ru'), true);
  assert.equal(ruFile.common?.appName, 'Приложение Lingva');
  assert.equal(ruFile.common?.welcome, '');
  assert.equal(ruFile.auth?.signIn?.title, '');
  assert.match(result.report, /generated project:/);
});

test('syncLingvaLocalFiles preserves config key metadata in generated projects', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-sync-metadata-'));

  await fs.mkdir(path.join(cwd, '.lingva/translations'), { recursive: true });
  await fs.writeFile(
    path.join(cwd, '.lingva/translations/en.json'),
    JSON.stringify({ app: { title: 'Hello' } }, null, 2)
  );
  await fs.writeFile(
    path.join(cwd, '.lingva/translations/ru.json'),
    JSON.stringify({ app: { title: 'Привет' } }, null, 2)
  );
  await fs.writeFile(
    path.join(cwd, 'lingva.config.ts'),
    [
      "import { defineLingvaConfig } from '@lingva/core';",
      '',
      'export default defineLingvaConfig({',
      "  projectId: 'metadata-demo',",
      "  locales: ['en', 'ru'],",
      "  defaultLocale: 'en',",
      "  fallbackLocale: 'en',",
      "  environment: 'development',",
      "  translationFiles: '.lingva/translations/{locale}.json',",
      "  generatedProjectFile: '.lingva/generated/project.ts',",
      "  delivery: { mode: 'local', path: '.lingva/translations/{locale}.json' },",
      '  keyMetadata: {',
      "    'app.title': {",
      "      description: 'Starter headline.',",
      "      namespace: 'app',",
      "      status: 'approved',",
      "      translator: 'starter@lingva.dev',",
      "      reviewer: 'starter@lingva.dev',",
      '    },',
      '  },',
      '});',
      '',
    ].join('\n')
  );

  await syncLingvaLocalFiles(path.join(cwd, 'lingva.config.ts'));

  const generatedFile = await fs.readFile(path.join(cwd, '.lingva/generated/project.ts'), 'utf8');
  const check = await checkLingvaLocalProject(path.join(cwd, 'lingva.config.ts'));

  assert.match(generatedFile, /keyMetadata/);
  assert.match(generatedFile, /Starter headline/);
  assert.match(generatedFile, /environment: 'development'/);
  assert.match(generatedFile, /export type LingvaProjectResources/);
  assert.match(generatedFile, /readonly 'app':/);
  assert.match(generatedFile, /readonly 'title': 'Hello'/);
  assert.match(check.validation.report, /0 warnings, 0 info/);
});

test('scaffoldLingvaMetadata writes missing metadata without overwriting existing entries', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-metadata-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });
  await fs.writeFile(
    path.join(cwd, '.lingva/metadata.json'),
    JSON.stringify(
      {
        'common.appName': {
          description: 'Existing app name metadata.',
          namespace: 'common',
          status: 'approved',
          translator: 'translator@lingva.dev',
          reviewer: 'reviewer@lingva.dev',
        },
      },
      null,
      2
    )
  );

  const result = await scaffoldLingvaMetadata(path.join(cwd, 'lingva.config.ts'));
  const metadata = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/metadata.json'), 'utf8')) as {
    'common.appName'?: { description?: string; status?: string };
    'common.welcome'?: { description?: string; status?: string };
  };

  assert.equal(result.added, 3);
  assert.equal(result.preserved, 1);
  assert.equal(metadata['common.appName']?.description, 'Existing app name metadata.');
  assert.equal(metadata['common.appName']?.status, 'approved');
  assert.equal(metadata['common.welcome']?.description, 'TODO: Describe "common.welcome".');
  assert.equal(metadata['common.welcome']?.status, 'draft');
});

test('scaffoldLingvaMetadata can report metadata drift without writing files', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-metadata-check-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });
  await fs.writeFile(
    path.join(cwd, '.lingva/metadata.json'),
    JSON.stringify(
      {
        'common.appName': {
          description: 'Existing app name metadata.',
          namespace: 'common',
          status: 'draft',
        },
      },
      null,
      2
    )
  );

  const result = await scaffoldLingvaMetadata(path.join(cwd, 'lingva.config.ts'), {
    write: false,
  });
  const metadata = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/metadata.json'), 'utf8')) as Record<
    string,
    unknown
  >;

  assert.equal(result.hasDrift, true);
  assert.equal(result.added, 3);
  assert.deepEqual(result.missingKeys, ['auth.signIn.subtitle', 'auth.signIn.title', 'common.welcome']);
  assert.equal(Object.keys(metadata).length, 1);
  assert.match(result.report, /missing keys: auth\.signIn\.subtitle, auth\.signIn\.title, common\.welcome/);
});

test('syncLingvaLocalFiles detects locale drift in check mode without writing files', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-sync-check-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/ru.json'),
    JSON.stringify(
      {
        common: {
          appName: 'Приложение Lingva',
        },
      },
      null,
      2
    )
  );

  const before = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');
  const result = await syncLingvaLocalFiles(path.join(cwd, 'lingva.config.ts'), {
    write: false,
    check: true,
  });
  const after = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');

  assert.equal(result.hasDrift, true);
  assert.equal(before, after);
  assert.match(result.report, /check: failed \(locale drift detected\)/);
});

test('syncLingvaLocalFiles preserves variant translation structure across locales', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-sync-variants-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/en.json'),
    JSON.stringify(
      {
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
                text: 'Let us ship.',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );
  await fs.writeFile(
    path.join(cwd, '.lingva/translations/ru.json'),
    JSON.stringify(
      {
        marketing: {
          hero: {
            title: [
              {
                id: 'warm',
                tone: 'warm',
                text: 'С возвращением.',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );

  await syncLingvaLocalFiles(path.join(cwd, 'lingva.config.ts'));

  const ruFile = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8')) as {
    marketing: {
      hero: {
        title: Array<{ id: string; text: string; tone?: string }>;
      };
    };
  };

  assert.deepEqual(
    ruFile.marketing.hero.title.map((variant) => variant.id),
    ['warm', 'bold']
  );
  assert.equal(ruFile.marketing.hero.title[0]?.text, 'С возвращением.');
  assert.equal(ruFile.marketing.hero.title[1]?.text, '');
});

test('syncLingvaLocalFiles reports variant drift separately in check mode', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-sync-variant-check-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/en.json'),
    JSON.stringify(
      {
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
                text: 'Let us ship.',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );
  await fs.writeFile(
    path.join(cwd, '.lingva/translations/ru.json'),
    JSON.stringify(
      {
        marketing: {
          hero: {
            title: [
              {
                id: 'warm',
                tone: 'formal',
                text: 'С возвращением.',
              },
              {
                id: 'playful',
                tone: 'playful',
                text: 'Поехали.',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );

  const before = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');
  const result = await syncLingvaLocalFiles(path.join(cwd, 'lingva.config.ts'), {
    check: true,
    format: 'json',
    write: false,
  });
  const after = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');
  const report = JSON.parse(result.report) as {
    files: Array<{
      locale: string;
      missingVariants: number;
      extraVariants: number;
      variantMetadataMismatches: number;
    }>;
  };
  const ruReport = report.files.find((file) => file.locale === 'ru');

  assert.equal(result.hasDrift, true);
  assert.equal(before, after);
  assert.equal(ruReport?.missingVariants, 1);
  assert.equal(ruReport?.extraVariants, 1);
  assert.equal(ruReport?.variantMetadataMismatches, 1);
});

test('checkLingvaLocalProject passes when local sync and validation are clean', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-check-pass-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  const result = await checkLingvaLocalProject(path.join(cwd, 'lingva.config.ts'));

  assert.equal(result.passed, true);
  assert.equal(result.sync.hasDrift, false);
  assert.equal(result.validation.shouldFail, false);
  assert.match(result.report, /Lingva check: passed/);
});

test('checkLingvaLocalProject fails without mutating files when local sync drifts', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-check-drift-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/ru.json'),
    JSON.stringify(
      {
        common: {
          appName: 'Приложение Lingva',
        },
      },
      null,
      2
    )
  );

  const before = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');
  const result = await checkLingvaLocalProject(path.join(cwd, 'lingva.config.ts'), {
    format: 'json',
  });
  const after = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');
  const report = JSON.parse(result.report) as {
    passed: boolean;
    sync: { hasDrift: boolean };
  };

  assert.equal(result.passed, false);
  assert.equal(result.sync.hasDrift, true);
  assert.equal(before, after);
  assert.equal(report.passed, false);
  assert.equal(report.sync.hasDrift, true);
});

test('validateLingvaProjectFile can fail only on variant drift', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-validate-variant-drift-'));
  const projectFile = path.join(cwd, 'lingva.project.mjs');

  await fs.writeFile(
    projectFile,
    `
import { createLingvaResources, defineLingvaProject } from '@lingva/core';

export default defineLingvaProject({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  resources: createLingvaResources({
    en: {
      hero: {
        title: [
          { id: 'warm', tone: 'warm', text: 'Welcome.' },
        ],
      },
    },
    de: {
      hero: {
        title: [
          { id: 'warm', tone: 'formal', text: 'Willkommen.' },
        ],
      },
    },
  }),
});
`,
    'utf8'
  );

  const result = await validateLingvaProjectFile(projectFile, {
    failOn: 'variant-drift',
    format: 'json',
  });

  assert.equal(result.shouldFail, true);
  assert.equal(result.valid, true);
  assert.match(result.report, /variant_metadata_mismatch/);
});

test('generateLingvaStudio renders a local translation tree preview', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-studio-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  const result = await generateLingvaStudio(path.join(cwd, 'lingva.config.ts'), {
    format: 'html',
  });

  assert.equal(result.defaultLocale, 'en');
  assert.ok(result.summary.totalKeys > 0);
  assert.match(result.report, /Lingva Studio Preview/);
  assert.match(result.report, /common\.appName/);
  assert.match(result.report, /Download en\.json/);
  assert.match(result.report, /textarea/);
});

test('generateLingvaStudio renders editable variant controls', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-studio-variants-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/en.json'),
    JSON.stringify(
      {
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
                text: 'Let us ship.',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );

  const result = await generateLingvaStudio(path.join(cwd, 'lingva.config.ts'), {
    format: 'html',
  });

  assert.match(result.report, /data-lingva-variant-id="warm"/);
  assert.match(result.report, /data-lingva-variant-id="bold"/);
});

test('applyLingvaLocalDictionary writes the default locale and re-syncs generated files', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-apply-default-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  const editedDefaultFile = path.join(cwd, 'edited-en.json');
  await fs.writeFile(
    editedDefaultFile,
    JSON.stringify(
      {
        common: {
          appName: 'Edited Lingva App',
        },
      },
      null,
      2
    )
  );

  const result = await applyLingvaLocalDictionary(path.join(cwd, 'lingva.config.ts'), {
    locale: 'en',
    inputFile: editedDefaultFile,
  });

  const updatedDefault = await fs.readFile(path.join(cwd, '.lingva/translations/en.json'), 'utf8');
  const updatedRu = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');

  assert.equal(result.synced, true);
  assert.match(updatedDefault, /Edited Lingva App/);
  assert.match(updatedDefault, /"welcome": "Welcome to Lingva"/);
  assert.match(updatedDefault, /"title": "Sign in"/);
  assert.match(updatedRu, /"welcome": ""/);
  assert.match(result.report, /sync: completed/);
});

test('applyLingvaLocalDictionary preserves safe merge behavior for non-default locales', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-apply-target-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  const editedTargetFile = path.join(cwd, 'edited-ru.json');
  await fs.writeFile(
    editedTargetFile,
    JSON.stringify(
      {
        common: {
          appName: 'Лингва',
        },
      },
      null,
      2
    )
  );

  const result = await applyLingvaLocalDictionary(path.join(cwd, 'lingva.config.ts'), {
    locale: 'ru',
    inputFile: editedTargetFile,
  });

  const updatedTarget = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');

  assert.equal(result.synced, false);
  assert.match(updatedTarget, /"appName": "Лингва"/);
  assert.match(updatedTarget, /"welcome": ""/);
  assert.match(result.report, /sync: skipped \(non-default locale\)/);
});

test('applyLingvaLocalDictionary patches default variant translations safely', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-apply-variants-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/en.json'),
    JSON.stringify(
      {
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
                text: 'Let us ship.',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );

  const editedDefaultFile = path.join(cwd, 'edited-en.json');
  await fs.writeFile(
    editedDefaultFile,
    JSON.stringify(
      {
        marketing: {
          hero: {
            title: [
              {
                id: 'warm',
                tone: 'warm',
                text: 'Welcome home.',
              },
              {
                id: 'bold',
                tone: 'bold',
                text: 'Ship it now.',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );

  await applyLingvaLocalDictionary(path.join(cwd, 'lingva.config.ts'), {
    locale: 'en',
    inputFile: editedDefaultFile,
  });

  const updatedDefault = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/en.json'), 'utf8')) as {
    marketing: {
      hero: {
        title: Array<{ id: string; text: string }>;
      };
    };
  };
  const updatedTarget = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8')) as {
    marketing: {
      hero: {
        title: Array<{ id: string; text: string }>;
      };
    };
  };

  assert.equal(updatedDefault.marketing.hero.title[0]?.text, 'Welcome home.');
  assert.equal(updatedTarget.marketing.hero.title[0]?.text, '');
  assert.equal(updatedTarget.marketing.hero.title[1]?.id, 'bold');
});

test('pushLingvaProject generates local publish artifacts without invalidation', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-push-local-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  const result = await pushLingvaProject(path.join(cwd, 'lingva.config.ts'), {
    format: 'text',
    outputDir: 'artifacts/push',
    cwd,
  });

  assert.equal(result.invalidation, undefined);
  assert.match(result.report, /Lingva publish artifacts/);
  await assert.doesNotReject(fs.stat(path.join(cwd, 'artifacts/push/manifest.json')));
});

test('pushLingvaProject can publish and invalidate through hosted control-plane endpoint', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-push-hosted-'));
  const originalFetch = globalThis.fetch;
  const requests: Array<{ body: Record<string, unknown>; url: string }> = [];

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  globalThis.fetch = (async (url, init) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });

    if (requests.length === 1) {
      return Response.json({
        publishId: 'publish_123',
        projectId: 'lingva-app',
        environment: 'development',
        publishedAt: '2026-04-27T08:05:00.000Z',
        manifestKey: 'lingva-app/development/publish_123/manifest.json',
        bundleKeys: {
          en: 'lingva-app/development/publish_123/en.bundle.json',
          ru: 'lingva-app/development/publish_123/ru.bundle.json',
        },
      });
    }

    return Response.json({
      apiUrl: 'https://publish.example',
      invalidationId: 'invalidate_123',
      projectId: 'lingva-app',
      environment: 'development',
      publishId: 'publish_123',
      manifestKey: 'lingva-app/development/publish_123/manifest.json',
      requestedAt: '2026-04-27T08:06:00.000Z',
      source: 'repository',
      status: 'queued',
    });
  }) as typeof fetch;

  try {
    const result = await pushLingvaProject(path.join(cwd, 'lingva.config.ts'), {
      apiUrl: 'https://publish.example',
      authToken: 'secret',
      cwd,
      invalidate: true,
      invalidateReason: 'Push after merge',
      force: true,
    });

    assert.equal(result.publish.hostedPublish?.publishId, 'publish_123');
    assert.equal(result.invalidation?.invalidation.invalidationId, 'invalidate_123');
    assert.equal(requests[0]?.body.action, 'publish');
    assert.equal(Object.hasOwn(requests[0]?.body ?? {}, 'baseRevision'), false);
    assert.match(String(requests[0]?.body.mutationId), /^sha256:[a-f0-9]{64}$/u);
    assert.equal(requests[1]?.body.action, 'invalidate');
    assert.equal(requests[1]?.body.reason, 'Push after merge');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('approveLingvaDraft applies a hosted draft payload to local translations', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-approve-draft-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  const draftFile = path.join(cwd, 'draft.json');
  await fs.writeFile(
    draftFile,
    JSON.stringify(
      {
        projectId: 'lingva-app',
        environment: 'dev',
        locale: 'ru',
        key: 'common.welcome',
        value: 'Добро пожаловать в Lingva',
      },
      null,
      2
    )
  );

  const result = await approveLingvaDraft(path.join(cwd, 'lingva.config.ts'), {
    draftFile,
  });
  const ruFile = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8')) as {
    common?: { welcome?: string };
  };

  assert.equal(ruFile.common?.welcome, 'Добро пожаловать в Lingva');
  assert.equal(result.synced, true);
  assert.match(result.report, /Lingva approve: ru:common\.welcome/);
});

test('approveLingvaDraft applies variant draft payloads', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-approve-variant-'));

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
  });

  await fs.writeFile(
    path.join(cwd, '.lingva/translations/ru.json'),
    JSON.stringify(
      {
        marketing: {
          hero: {
            title: [
              {
                id: 'warm',
                text: '',
              },
            ],
          },
        },
      },
      null,
      2
    )
  );

  const draftFile = path.join(cwd, 'draft-variant.json');
  await fs.writeFile(
    draftFile,
    JSON.stringify(
      {
        projectId: 'lingva-app',
        locale: 'ru',
        key: 'marketing.hero.title',
        value: 'С возвращением.',
        variantId: 'warm',
      },
      null,
      2
    )
  );

  await approveLingvaDraft(path.join(cwd, 'lingva.config.ts'), {
    draftFile,
    sync: false,
  });

  const ruFile = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8')) as {
    marketing?: { hero?: { title?: Array<{ id: string; text: string }> } };
  };

  assert.equal(ruFile.marketing?.hero?.title?.[0]?.text, 'С возвращением.');
});

test('listHostedLingvaDrafts fetches hosted drafts and exports approval payloads', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-list-drafts-'));
  const requests: Array<{
    url: string;
    body: Record<string, unknown>;
    auth?: string | null;
  }> = [];
  const originalFetch = globalThis.fetch;

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
    projectId: 'lingva-app',
  });

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      auth: headers.get('authorization'),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        count: 1,
        nextToken: 'next-page-token',
        drafts: [
          {
            projectId: 'lingva-app',
            environment: 'stage',
            draftId: 'draft_123',
            locale: 'ru',
            key: 'common.welcome',
            value: 'Добро пожаловать',
            authorId: 'translator@example.com',
            status: 'draft',
            createdAt: '2026-04-27T08:00:00.000Z',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    const outputDir = path.join(cwd, 'drafts');
    const result = await listHostedLingvaDrafts(path.join(cwd, 'lingva.config.ts'), {
      cwd,
      apiUrl: 'https://authoring.example',
      authToken: 'secret-token',
      environment: 'stage',
      locale: 'ru',
      key: 'common.welcome',
      outputDir,
    });

    assert.equal(result.drafts.length, 1);
    assert.equal(result.outputFiles.length, 1);
    assert.match(result.report, /Lingva drafts: 1 hosted draft/);
    assert.equal(requests[0]?.auth, 'Bearer secret-token');
    assert.equal(requests[0]?.body.action, 'list-drafts');
    assert.equal(requests[0]?.body.projectId, 'lingva-app');
    assert.equal(requests[0]?.body.environment, 'stage');
    assert.equal(requests[0]?.body.locale, 'ru');
    assert.equal(requests[0]?.body.key, 'common.welcome');
    assert.equal(requests[0]?.body.status, undefined);
    assert.equal(requests[0]?.body.nextToken, undefined);
    assert.equal(result.status, 'draft');
    assert.equal(result.nextToken, 'next-page-token');
    assert.match(result.report, /Next page token: next-page-token/);

    const exported = JSON.parse(await fs.readFile(result.outputFiles[0] ?? '', 'utf8')) as {
      draftId?: string;
      key?: string;
      status?: string;
    };
    assert.equal(exported.draftId, 'draft_123');
    assert.equal(exported.key, 'common.welcome');
    assert.equal(exported.status, 'draft');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('listHostedLingvaDrafts supports status filters for review queues', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-list-drafts-status-'));
  const requests: Array<{ body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
    projectId: 'lingva-app',
  });

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ body });

    return new Response(
      JSON.stringify({
        ok: true,
        count: 1,
        nextToken: 'approved-next-page',
        drafts: [
          {
            projectId: 'lingva-app',
            environment: 'stage',
            draftId: 'draft_approved',
            locale: 'ru',
            key: 'common.welcome',
            value: 'Reviewed copy',
            status: 'approved',
            createdAt: '2026-04-27T08:00:00.000Z',
            approvedAt: '2026-04-27T08:05:00.000Z',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    const result = await listHostedLingvaDrafts(path.join(cwd, 'lingva.config.ts'), {
      cwd,
      apiUrl: 'https://authoring.example',
      environment: 'stage',
      status: 'approved',
      nextToken: 'approved-current-page',
      format: 'json',
    });

    assert.equal(requests[0]?.body.status, 'approved');
    assert.equal(requests[0]?.body.nextToken, 'approved-current-page');
    assert.equal(result.status, 'approved');
    assert.equal(result.nextToken, 'approved-next-page');
    assert.equal(result.drafts[0]?.status, 'approved');
    assert.match(result.report, /"nextToken": "approved-next-page"/);
    assert.match(result.report, /"status": "approved"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('approveLingvaDraft can apply a hosted draft by id and mark it approved', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-approve-hosted-draft-'));
  const requests: Array<{
    body: Record<string, unknown>;
    auth?: string | null;
  }> = [];
  const originalFetch = globalThis.fetch;

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
    projectId: 'lingva-app',
  });

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({
      body,
      auth: headers.get('authorization'),
    });

    const responseBody =
      body.action === 'approve-draft'
        ? {
            ok: true,
            draftId: body.draftId,
            status: 'approved',
            approvedAt: '2026-04-27T08:05:00.000Z',
          }
        : {
            ok: true,
            count: 1,
            drafts: [
              {
                projectId: 'lingva-app',
                environment: 'stage',
                draftId: 'draft_approve',
                locale: 'ru',
                key: 'common.welcome',
                value: 'Привет из hosted draft',
                createdAt: '2026-04-27T08:00:00.000Z',
              },
            ],
          };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const result = await approveLingvaDraft(path.join(cwd, 'lingva.config.ts'), {
      cwd,
      apiUrl: 'https://authoring.example',
      authToken: 'secret-token',
      environment: 'stage',
      draftId: 'draft_approve',
      approvedBy: 'reviewer@example.com',
    });
    const ruFile = JSON.parse(await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8')) as {
      common?: { welcome?: string };
    };

    assert.equal(ruFile.common?.welcome, 'Привет из hosted draft');
    assert.equal(result.synced, true);
    assert.equal(result.hostedApproval?.status, 'approved');
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.auth, 'Bearer secret-token');
    assert.equal(requests[0]?.body.action, 'list-drafts');
    assert.equal(requests[1]?.body.action, 'approve-draft');
    assert.equal(requests[1]?.body.draftId, 'draft_approve');
    assert.equal(requests[1]?.body.approvedBy, 'reviewer@example.com');
    assert.match(result.report, /hosted draft: draft_approve/);
    assert.match(result.report, /hosted status: approved/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('approveLingvaDraft can push and invalidate after hosted draft approval', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-approve-push-'));
  const requests: Array<{
    url: string;
    body: Record<string, unknown>;
    auth?: string | null;
  }> = [];
  const originalFetch = globalThis.fetch;

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
    projectId: 'lingva-app',
  });

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({
      url: String(url),
      body,
      auth: headers.get('authorization'),
    });

    if (body.action === 'list-drafts') {
      return new Response(
        JSON.stringify({
          ok: true,
          drafts: [
            {
              projectId: 'lingva-app',
              environment: 'stage',
              draftId: 'draft_push',
              locale: 'ru',
              key: 'common.welcome',
              value: 'Публикуем approved draft',
              createdAt: '2026-04-27T08:00:00.000Z',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    if (body.action === 'approve-draft') {
      return new Response(
        JSON.stringify({
          ok: true,
          draftId: body.draftId,
          status: 'approved',
          approvedAt: '2026-04-27T08:05:00.000Z',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    if (body.action === 'invalidate') {
      return new Response(
        JSON.stringify({
          apiUrl: 'https://publish.example',
          invalidationId: 'invalidate_123',
          projectId: 'lingva-app',
          environment: 'stage',
          publishId: 'publish_123',
          manifestKey: 'lingva-app/stage/publish_123/manifest.json',
          requestedAt: '2026-04-27T08:06:00.000Z',
          source: 'repository',
          status: 'queued',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        publishId: 'publish_123',
        projectId: 'lingva-app',
        environment: 'stage',
        publishedAt: '2026-04-27T08:05:30.000Z',
        manifestKey: 'lingva-app/stage/publish_123/manifest.json',
        bundleKeys: {
          en: 'lingva-app/stage/publish_123/en.bundle.json',
          ru: 'lingva-app/stage/publish_123/ru.bundle.json',
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    const result = await approveLingvaDraft(path.join(cwd, 'lingva.config.ts'), {
      cwd,
      draftId: 'draft_push',
      apiUrl: 'https://authoring.example',
      authToken: 'authoring-token',
      environment: 'stage',
      push: true,
      forcePush: true,
      publishApiUrl: 'https://publish.example',
      publishAuthToken: 'publish-token',
      invalidate: true,
      invalidateEnvironment: 'stage',
      invalidateReason: 'Approved draft publish',
    });

    assert.equal(result.push?.publish.hostedPublish?.publishId, 'publish_123');
    assert.equal(result.push?.invalidation?.invalidation.invalidationId, 'invalidate_123');
    assert.equal(requests.length, 4);
    assert.deepEqual(
      requests.map((request) => request.body.action),
      ['list-drafts', 'approve-draft', 'publish', 'invalidate']
    );
    assert.equal(requests[0]?.auth, 'Bearer authoring-token');
    assert.equal(requests[2]?.auth, 'Bearer publish-token');
    assert.match(result.report, /Hosted publish: lingva-app/);
    assert.match(result.report, /Lingva invalidation:/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('approveLingvaDraft dry-run plans promotion without mutating files or hosted state', async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'lingva-approve-dry-run-'));
  const requests: Array<{ body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;

  await initializeLingvaProject({
    cwd,
    mode: 'local',
    locales: ['en', 'ru'],
    projectId: 'lingva-app',
  });

  const before = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ body });

    return new Response(
      JSON.stringify({
        ok: true,
        drafts: [
          {
            projectId: 'lingva-app',
            environment: 'stage',
            draftId: 'draft_dry_run',
            locale: 'ru',
            key: 'common.welcome',
            value: 'Dry run only',
            createdAt: '2026-04-27T08:00:00.000Z',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    const result = await approveLingvaDraft(path.join(cwd, 'lingva.config.ts'), {
      cwd,
      draftId: 'draft_dry_run',
      apiUrl: 'https://authoring.example',
      authToken: 'authoring-token',
      environment: 'stage',
      push: true,
      publishApiUrl: 'https://publish.example',
      publishAuthToken: 'publish-token',
      invalidate: true,
      dryRun: true,
    });
    const after = await fs.readFile(path.join(cwd, '.lingva/translations/ru.json'), 'utf8');

    assert.equal(after, before);
    assert.equal(result.dryRun, true);
    assert.equal(result.hostedApproval, undefined);
    assert.equal(result.push, undefined);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.body.action, 'list-drafts');
    assert.match(result.report, /Lingva approve plan/);
    assert.match(result.report, /push: planned/);
    assert.match(result.report, /invalidate: planned/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
