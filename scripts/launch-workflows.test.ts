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
