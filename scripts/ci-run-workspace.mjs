/** Run only planner-selected packages; argument arrays never enter a shell. */
/* eslint-disable turbo/no-undeclared-env-vars -- Standalone Actions boundary; selectors are consumed before Turbo starts. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const PACKAGE_MANAGER = 'pnpm';
let failed = false;
const packages = JSON.parse(process.env.CI_PACKAGES ?? '[]');
const files = JSON.parse(process.env.CI_FILES ?? '[]').filter((file) => fs.existsSync(file));
for (const name of packages) {
  if (!/^@lingva\/[a-z0-9-]+$/u.test(name)) throw new Error(`Invalid CI package selector: ${name}`);
}
function run(args) {
  const result = spawnSync(PACKAGE_MANAGER, args, { stdio: 'inherit' });
  if (result.error) console.error(result.error);
  failed ||= Boolean(result.error) || result.status !== 0;
}
if (files.length) run(['exec', 'prettier', '--check', '--ignore-unknown', '--', ...files]);
if (process.env.CI_REPO_CHECKS === 'true') {
  run(['audit:prod']);
  run(['test:dependency-security']);
  run(['lint:repo']);
  run(['test:cli-release']);
  run(['exec', 'node', '--test', 'scripts/ci-plan.test.mjs']);
  if (fs.existsSync('scripts/repository-split/layout.test.mjs')) run(['test:repository-split']);
}
if (packages.length) {
  // Continue across independent tasks, so one failure does not hide the rest.
  run([
    'exec',
    'turbo',
    'run',
    'lint',
    'typecheck',
    'test',
    '--continue',
    ...packages.map((name) => `--filter=${name}`),
  ]);
}
if (failed) process.exitCode = 1;
