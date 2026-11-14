import { expect, test } from 'bun:test';
import { blankWorkspace, PROCESS_TEMPLATES, readWorkspace, WORKSPACE_KEY, workspaceGaps, workspaceOutline, workspaceSummary } from './proposal-workspace';

test('all four process outlines are jurisdiction-specific and unknown inputs stay unresolved', () => {
  expect(PROCESS_TEMPLATES.city).toContain('ordinance');
  expect(PROCESS_TEMPLATES.county).toContain('delegated powers');
  expect(PROCESS_TEMPLATES.state).toContain('State bill');
  expect(PROCESS_TEMPLATES.federal).toContain('congressional');
  const values = blankWorkspace();
  expect(workspaceGaps(values).map(g => g.field)).toEqual(expect.arrayContaining(['jurisdiction', 'costs', 'sources']));
  expect(workspaceOutline(values)).toContain('[Missing — needs review]');
  expect(workspaceSummary(values)).toContain('[Problem missing]');
});

test('city bus fixture retains uncertainty, disputed authority, supplied text and sources through storage', () => {
  const values = { ...blankWorkspace(), title: 'Later buses', jurisdiction: 'city' as const,
    problem: 'My shift ends after the last bus.', affected: 'Night workers', benefit: 'A route home',
    mechanism: 'Pilot a later route', authority: 'Council? Transit board? Unverified.', costs: 'Unknown; ask operator',
    objections: 'Operating costs and staffing', sources: 'https://example.org/timetable', text: 'Operate a late service pilot.' };
  const draft = { version: 1 as const, id: 'stable-id', savedAt: '2026-11-13', values };
  const resumed = readWorkspace(JSON.stringify(draft))!;
  expect(resumed).toEqual(draft);
  expect(workspaceGaps(resumed.values)).toEqual([]);
  expect(workspaceOutline(resumed.values)).toContain('Unknown; ask operator');
  expect(workspaceOutline(resumed.values)).toContain('Proposed new text / no verified baseline');
  expect(workspaceSummary(values)).not.toContain('Congress');
});

test('unsafe, malformed and credential-bearing sources remain text and are flagged', () => {
  for (const sources of ['javascript:alert(1)', 'file:///etc/passwd', 'https://u:p@example.org', 'not a link']) {
    expect(workspaceGaps({ ...blankWorkspace(), sources }).some(g => g.field === 'sources')).toBe(true);
  }
  expect(workspaceGaps({ ...blankWorkspace(), sources: 'https://example.org/a\nhttp://example.org/b' }).some(g => g.field === 'sources')).toBe(false);
});

test('corrupt and incompatible storage is rejected without changing legacy drafts', () => {
  expect(readWorkspace(null)).toBeNull();
  for (const raw of ['{', '{}', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, id: 'x', savedAt: '', values: { ...blankWorkspace(), jurisdiction: '__proto__' } })]) {
    expect(() => readWorkspace(raw)).toThrow();
  }
  expect(WORKSPACE_KEY).not.toBe('civic_synthesis_proposal_drafts_v1');
});

test('guided UI completes private save/resume and review without publication or network writes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-proposal-workspace.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stderr, stdout }).toEqual({ code: 0, stderr: '', stdout: 'PASS private guided workspace\n' });
});
