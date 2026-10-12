/** Scope CI by the complete diff; reuse only exact-input successful proofs. */
/* eslint-disable turbo/no-undeclared-env-vars -- Standalone Actions boundary; these values never enter Turbo tasks. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const GROUPS = Object.freeze(['cli', 'workspace', 'docs', 'swift', 'kotlin', 'python', 'flutter']);
const ROOT_INPUTS = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'tsdown.shared.ts',
  'eslint.config.js',
  '.prettierrc',
  '.prettierignore',
]);
const PROOF_PREFIX = 'ci-proof-v1-';
const PROOF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SUCCESS = 'success';
const SKIPPED = 'skipped';
const ROUTING_STATUS = { UNAFFECTED: 'not affected', REUSED: 'reuse exact successful input proof', RUN: 'run' };
const EVENT_PULL_REQUEST = 'pull_request';
const EVENT_PUSH = 'push';
const SDK_GROUPS = ['swift', 'kotlin', 'python', 'flutter'];
const GROUP_SEEDS = {
  cli: ['@lingva/cli'],
  docs: ['@lingva/docs'],
};

export function isDocumentation(file) {
  return /\.(?:md|mdx)$/u.test(file) || /^(?:apps\/docs\/|docs\/)/u.test(file);
}

export function dependencyClosure(names, packages, direction) {
  const selected = new Set(names);
  let previous;
  do {
    previous = selected.size;
    for (const item of packages) {
      if (direction === 'dependents' && item.dependencies.some((name) => selected.has(name))) selected.add(item.name);
      if (direction === 'dependencies' && selected.has(item.name))
        item.dependencies.forEach((name) => selected.add(name));
    }
  } while (selected.size !== previous);
  return [...selected].sort();
}

export function routeChanges(changed, packages) {
  const required = Object.fromEntries(GROUPS.map((group) => [group, false]));
  const packageNames = new Set();
  for (const file of changed) {
    if (isDocumentation(file)) {
      required.docs = true;
      continue;
    }
    const routing = file.startsWith('scripts/ci-') || file === '.github/workflows/ci.yml';
    const global =
      routing ||
      ROOT_INPUTS.has(file) ||
      file.startsWith('patches/') ||
      (file.startsWith('scripts/') && !/cli|homebrew/u.test(file));
    if (global) packages.forEach((item) => packageNames.add(item.name));
    if (
      routing ||
      file.startsWith('crates/') ||
      file.startsWith('Cargo.') ||
      file.startsWith('packages/cli/') ||
      file.startsWith('sdks/python-cli/') ||
      /^(?:scripts\/(?:.*cli.*|.*homebrew.*)|packaging\/homebrew\/)/u.test(file) ||
      [
        '.github/workflows/release-cli.yml',
        '.github/workflows/cli-quality.yml',
        '.github/workflows/publish-python-cli.yml',
      ].includes(file)
    )
      required.cli = true;
    if (
      routing ||
      file.startsWith('packages/core/') ||
      file.startsWith('sdks/fixtures/') ||
      file === '.github/workflows/native-sdk-previews.yml'
    ) {
      for (const sdk of SDK_GROUPS) required[sdk] = true;
    }
    for (const sdk of SDK_GROUPS) {
      if (
        file.startsWith(`sdks/${sdk}/`) ||
        file === `.github/workflows/publish-python-${sdk === 'python' ? 'sdk' : sdk}.yml`
      )
        required[sdk] = true;
    }
    const owner = [...packages]
      .sort((a, b) => b.directory.length - a.directory.length)
      .find((item) => file.startsWith(`${item.directory}/`));
    if (owner) packageNames.add(owner.name);
    // Unowned configuration/code must not silently bypass verification.
    const known =
      global ||
      owner ||
      /^(?:crates\/|Cargo\.|packaging\/homebrew\/|scripts\/)/u.test(file) ||
      ['python-cli', 'fixtures', ...SDK_GROUPS].some((sdk) => file.startsWith(`sdks/${sdk}/`)) ||
      [
        '.github/workflows/release-cli.yml',
        '.github/workflows/cli-quality.yml',
        '.github/workflows/publish-python-cli.yml',
        '.github/workflows/native-sdk-previews.yml',
        '.github/CODEOWNERS',
        '.gitignore',
        'LICENSE',
      ].includes(file);
    if (!known) {
      packages.forEach((item) => packageNames.add(item.name));
      for (const group of GROUPS) required[group] = true;
    }
  }
  const affected = dependencyClosure([...packageNames], packages, 'dependents');
  required.cli ||= affected.includes('@lingva/cli');
  required.docs ||= affected.some((name) => ['@lingva/docs'].includes(name)) || required.cli || required.python;
  const workspace = affected.filter((name) => !['@lingva/cli', '@lingva/docs'].includes(name));
  required.workspace =
    workspace.length > 0 || changed.some((file) => file.startsWith('scripts/') || ROOT_INPUTS.has(file));
  return { required, workspace };
}

export function proofKey(group, files, selectors = []) {
  const hash = createHash('sha256').update(JSON.stringify([...selectors].sort()));
  for (const [name, blob] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    hash.update(`\0${name}\0${blob}`);
  }
  return `${PROOF_PREFIX}${group}-${hash.digest('hex')}`;
}

export function hasSuccessfulProof(key, ref, caches, now = Date.now()) {
  return caches.some(
    (entry) =>
      entry.key === key &&
      entry.ref === ref &&
      entry.size_in_bytes > 0 &&
      Number.isFinite(Date.parse(entry.created_at)) &&
      now - Date.parse(entry.created_at) >= 0 &&
      now - Date.parse(entry.created_at) < PROOF_MAX_AGE_MS
  );
}

export function verifyResults(plan, results) {
  for (const group of GROUPS) {
    if (typeof plan.required[group] !== 'boolean' || typeof plan.run[group] !== 'boolean' || !results[group])
      throw new Error(`Missing or invalid ${group} verification state.`);
    if (plan.run[group] && !plan.required[group]) throw new Error(`Unexpected ${group} scheduling state.`);
    if (plan.required[group] && plan.run[group] && results[group]?.result !== SUCCESS)
      throw new Error(`${group} did not pass.`);
    if (results[group] && ![SUCCESS, SKIPPED].includes(results[group].result))
      throw new Error(`${group} failed or was cancelled.`);
  }
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function trackedTree(ref) {
  return Object.fromEntries(
    git(['ls-tree', '-r', '-z', ref])
      .split('\0')
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('\t');
        const metadata = line.slice(0, separator);
        const name = line.slice(separator + 1);
        return [name, metadata.split(' ')[2]];
      })
  );
}

function workspacePackages(tree, ref) {
  return Object.keys(tree)
    .filter((file) =>
      /^(?:apps\/[^/]+|packages\/[^/]+|packages\/infrastructure\/aws|examples\/[^/]+)\/package\.json$/u.test(file)
    )
    .map((file) => {
      const manifest = JSON.parse(git(['show', `${ref}:${file}`]));
      return {
        name: manifest.name,
        directory: file.slice(0, -'/package.json'.length),
        dependencies: Object.keys({
          ...manifest.dependencies,
          ...manifest.devDependencies,
          ...manifest.peerDependencies,
        }),
      };
    });
}

export function groupInputs(group, tree, packages, workspace) {
  const seeds = group === 'workspace' ? workspace : (GROUP_SEEDS[group] ?? []);
  const dependencies = dependencyClosure(seeds, packages, 'dependencies');
  const directories = packages.filter((item) => dependencies.includes(item.name)).map((item) => `${item.directory}/`);
  return Object.fromEntries(
    Object.entries(tree).filter(([file]) => {
      if (
        ROOT_INPUTS.has(file) ||
        file.startsWith('patches/') ||
        file.startsWith('scripts/') ||
        file.startsWith('.github/workflows/')
      )
        return true;
      // Documentation contract tests read cross-plane source/configuration files.
      // Include the complete tree rather than risk falsely reusing these proofs.
      if (group === 'docs') return true;
      if (isDocumentation(file)) return false;
      // Unknown files selected by the conservative router must also invalidate
      // proofs. Otherwise a newly introduced code/config path could reuse one.
      const owner = packages.some((item) => file.startsWith(`${item.directory}/`));
      const knownSdk = ['python-cli', 'fixtures', ...SDK_GROUPS].some((sdk) => file.startsWith(`sdks/${sdk}/`));
      if (!owner && !knownSdk) return true;
      if (directories.some((directory) => file.startsWith(directory))) return true;
      if (group === 'cli' && /^(?:crates\/|Cargo\.|sdks\/python-cli\/|packaging\/)/u.test(file)) return true;
      return (
        file.startsWith(`sdks/${group}/`) || file.startsWith('sdks/fixtures/') || file.startsWith('packages/core/src/')
      );
    })
  );
}

async function main() {
  if (process.argv[2] === 'verify') {
    const results = JSON.parse(process.env.CI_RESULTS);
    if (results.plan?.result !== SUCCESS) throw new Error('CI planning failed.');
    verifyResults(JSON.parse(process.env.CI_PLAN), results);
    return;
  }
  const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const head = event.pull_request?.head.sha ?? event.after ?? 'HEAD';
  const base = event.pull_request?.base.sha ?? event.before;
  // Fingerprint the merge tree checked out by every PR job, not just its head.
  const tree = trackedTree('HEAD');
  const missingBase = !base || /^0+$/u.test(base);
  const changed = missingBase
    ? Object.keys(tree)
    : git([
        'diff',
        '--no-renames',
        '--name-only',
        '-z',
        process.env.GITHUB_EVENT_NAME === EVENT_PULL_REQUEST ? `${base}...${head}` : base,
        ...(process.env.GITHUB_EVENT_NAME === EVENT_PULL_REQUEST ? [] : [head]),
      ])
        .split('\0')
        .filter(Boolean);
  const packages = workspacePackages(tree, 'HEAD');
  // Deleted workspace manifests can remove dependency edges. Fail closed to
  // full workspace verification instead of inferring an incomplete graph.
  if (changed.some((file) => file.endsWith('/package.json') && !tree[file])) changed.push('pnpm-workspace.yaml');
  const plan = routeChanges(changed, packages);
  const keys = Object.fromEntries(
    GROUPS.map((group) => [
      group,
      proofKey(group, groupInputs(group, tree, packages, plan.workspace), group === 'workspace' ? plan.workspace : []),
    ])
  );
  let caches = [];
  // Reuse only same-ref, immutable successful proofs. Cache/API misses and
  // permission failures rerun checks. No cross-branch or prefix fallback.
  if ([EVENT_PULL_REQUEST, EVENT_PUSH].includes(process.env.GITHUB_EVENT_NAME)) {
    try {
      const query = new URLSearchParams({ key: PROOF_PREFIX, ref: process.env.GITHUB_REF, per_page: '100' });
      const response = await fetch(
        `${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/actions/caches?${query}`,
        {
          headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
        }
      );
      if (response.ok) caches = (await response.json()).actions_caches ?? [];
    } catch {
      /* Fail closed: do not reuse unverifiable results. */
    }
  }
  plan.keys = keys;
  plan.run = Object.fromEntries(
    GROUPS.map((group) => [
      group,
      plan.required[group] && !hasSuccessfulProof(keys[group], process.env.GITHUB_REF, caches),
    ])
  );
  const output = [
    `plan=${JSON.stringify(plan)}`,
    `packages=${JSON.stringify(plan.workspace)}`,
    `files=${JSON.stringify(changed.filter((file) => tree[file]))}`,
    ...GROUPS.flatMap((group) => [`${group}=${plan.run[group]}`, `${group}_key=${keys[group]}`]),
  ].join('\n');
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${output}\n`);
  await fs.appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `## CI routing\n\n${GROUPS.map((group) => {
      let status = ROUTING_STATUS.UNAFFECTED;
      if (plan.required[group]) status = ROUTING_STATUS.REUSED;
      if (plan.run[group]) status = ROUTING_STATUS.RUN;
      return `- ${group}: ${status}`;
    }).join('\n')}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
