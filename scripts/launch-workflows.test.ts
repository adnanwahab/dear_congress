import { expect, test } from 'bun:test';

const read = async (name: string): Promise<any> => Bun.YAML.parse(
  await Bun.file(new URL(`../.github/workflows/${name}.yml`, import.meta.url)).text(),
);

test('every main PR runs all three named checks without path filtering or secrets', async () => {
  const ci = await read('ci');
  expect(ci.on.pull_request).toEqual({ branches: ['main'] });
  expect(ci.permissions).toEqual({ contents: 'read' });
  expect(ci.jobs.checks.if).toBeUndefined();
  expect(ci.jobs.checks['continue-on-error']).toBeUndefined();
  expect(ci.jobs.checks.strategy.matrix.check).toEqual([
    { name: 'bun test', command: 'bun test' },
    { name: 'bun run typecheck', command: 'bun run typecheck' },
    { name: 'route smoke test', command: 'bun run test:routes' },
  ]);
  expect(JSON.stringify(ci)).not.toContain('secrets.');
});

test('production deploy requires a published release, passing validation and operator enablement', async () => {
  const workflow = await read('fly-deploy');
  expect(workflow.on).toEqual({ release: { types: ['published'] } });
  expect(workflow.jobs.validate.if).toBe("github.event.release.prerelease == false && startsWith(github.event.release.tag_name, 'v')");
  expect(workflow.jobs.deploy.needs).toBe('validate');
  expect(workflow.jobs.deploy.if).toBe("vars.PRODUCTION_RELEASES_ENABLED == 'true'");
  expect(workflow.jobs.validate.steps.filter((step: any) => step.run?.startsWith('bun ')).map((step: any) => step.run)).toEqual([
    'bun install --frozen-lockfile', 'bun test', 'bun run typecheck', 'bun run test:routes',
  ]);
  const revision = workflow.jobs.validate.steps.find((step: any) => step.id === 'revision');
  expect(revision.run).toContain('git merge-base --is-ancestor HEAD origin/main');
  expect(revision.run).toContain('git rev-parse HEAD');
  expect(workflow.jobs.validate.outputs.commit).toBe('${{ steps.revision.outputs.commit }}');
  expect(workflow.jobs.deploy.steps[0].with.ref).toBe('${{ needs.validate.outputs.commit }}');
  expect(JSON.stringify(workflow.jobs.validate)).not.toContain('secrets.');
});


test('release image and smoke verification bind to the validated full SHA', async () => {
  const workflow = await read('fly-deploy');
  const steps = workflow.jobs.deploy.steps;
  const deploy = steps.find((step: any) => step.run?.startsWith('flyctl deploy'));
  expect(deploy.run).toContain('--build-arg BUILD_COMMIT="$RELEASE_COMMIT"');
  expect(deploy.env.RELEASE_COMMIT).toBe('${{ needs.validate.outputs.commit }}');
  const smoke = steps.find((step: any) => step.name === 'Verify deployed release identity');
  expect(smoke.run).toContain('scripts/verify-release.ts https://civic-synthesis.fly.dev "$RELEASE_COMMIT"');
  expect(smoke.env.RELEASE_COMMIT).toBe('${{ needs.validate.outputs.commit }}');
  expect(steps.indexOf(smoke)).toBeGreaterThan(steps.indexOf(deploy));
});

test('production parity browser is SHA-bound and preserves redacted evidence on failure', async () => {
  const steps = (await read('fly-deploy')).jobs.deploy.steps;
  const browser = steps.find((step: any) => step.name === 'Verify production desktop and mobile parity');
  expect(browser.run).toContain('https://civic-synthesis.fly.dev "$RELEASE_COMMIT"');
  expect(browser.env.RELEASE_COMMIT).toBe('${{ needs.validate.outputs.commit }}');
  expect(browser['continue-on-error']).toBeUndefined();
  const evidence = steps.find((step: any) => step.uses === 'actions/upload-artifact@v4');
  expect(evidence.if).toBe('always()');
  expect(evidence.with.path).toBe('release-parity-*.json');
});
