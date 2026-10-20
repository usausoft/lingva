/** Release credentials stay confined to gated publication, never native proof or SDK verification. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

for (const file of ['release.yml', 'release-cli.yml']) {
  const workflow = parse(fs.readFileSync(`.github/workflows/${file}`, 'utf8'));
  test(`${file}: temporary credential cannot reach verification or native build jobs`, () => {
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (!['publish', 'release'].includes(name)) {
        assert.doesNotMatch(JSON.stringify(job), /secrets\.NPM_RELEASE_TOKEN/);
        continue;
      }
      assert.equal(job.environment, 'Production');
      assert.equal(job.permissions['id-token'], 'write', 'Provenance still needs GitHub OIDC.');
      assert.equal(job.env.NPM_AUTH_MODE, "${{ secrets.NPM_RELEASE_TOKEN != '' && 'token' || 'oidc' }}");
      const credentialSteps = job.steps.filter((step) => JSON.stringify(step).includes('secrets.NPM_RELEASE_TOKEN'));
      assert.equal(credentialSteps.length, 2);
      for (const step of credentialSteps) {
        assert.match(step.name, /^(Verify temporary npm credential|Publish )/);
        assert.equal(step.env.NODE_AUTH_TOKEN, '${{ secrets.NPM_RELEASE_TOKEN }}');
      }
      const publication = job.steps.find((step) => step.name?.startsWith('Publish '));
      if (file === 'release.yml') {
        assert.equal(workflow.env.NPM_CONFIG_PROVENANCE, true);
        assert.equal(publication.with.script, 'pnpm release');
        assert.equal(job.steps[0].with.ref, '${{ needs.verify.outputs.revision }}');
      } else {
        assert.match(publication.run, /--provenance/);
        assert.match(job.if, /needs\.build\.result == 'success'/);
        assert.equal(workflow.jobs.build.strategy['fail-fast'], false);
      }
    }
  });
  test(`${file}: embedded shell steps parse`, () => {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (!step.run) continue;
        if (step.shell === 'pwsh') continue;
        const result = spawnSync('bash', ['-n'], { input: step.run, encoding: 'utf8' });
        assert.equal(result.status, 0, `${step.name ?? 'step'}: ${result.stderr}`);
      }
    }
  });
}

test('SDK recovery accepts only matching recovery tags and revisions already reviewed on main', () => {
  const workflow = parse(fs.readFileSync('.github/workflows/release.yml', 'utf8'));
  const guard = workflow.jobs.verify.steps.find((step) => step.id === 'identity').run;
  assert.match(guard, /git merge-base --is-ancestor "\$GITHUB_WORKFLOW_SHA" origin\/main/);
  assert.match(guard, /git merge-base --is-ancestor HEAD origin\/main/);
  assert.ok(guard.includes('git rev-parse "refs/tags/$SDK_RELEASE_TAG^{commit}"'));
  // Isolate ref selection from Git operations so hostile or unrelated refs fail before execution.
  const selection = guard.slice(guard.indexOf('case '), guard.indexOf('esac') + 4);
  for (const [ref, expected] of [
    ['refs/tags/sdk-recovery/v0.2.0', 0],
    ['refs/tags/sdk-recovery-v0.2.0', 0],
    ['refs/heads/main', 1],
    ['refs/tags/sdk-recovery-v0.2.1', 1],
    ['refs/tags/unrelated', 1],
  ]) {
    const result = spawnSync('bash', ['-e', '-c', selection], {
      env: { ...process.env, WORKFLOW_REF: ref, SDK_RELEASE_TAG: 'v0.2.0' },
    });
    assert.equal(result.status, expected, ref);
  }
});
