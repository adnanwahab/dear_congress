import { expect, test } from 'bun:test';
import { workshopNotes, workshopExport, WORKSHOP_AGENDA } from './proposal-workshop';
const source = { id: 'a/b', title: 'Later buses', problem: 'Missed shifts', proposedChange: 'Pilot', supportingInfo: 'Unverified timetable', publishedAt: '2026-11-14', sourceEntryId: 'journal-1' };
test('agenda and export preserve provenance, uncertainty and original source', () => {
  const before = JSON.stringify(source);
  const notes = workshopNotes(source); notes.options = 'Different option';
  const text = workshopExport(source, notes, 'Facilitator');
  expect(WORKSHOP_AGENDA).toHaveLength(6);
  expect(text).toContain('/proposals/a%2Fb');
  expect(text).toContain('Journal source: journal-1');
  expect(text).toContain('Facilitator'); expect(text).toContain('Unverified timetable');
  expect(text).toContain('[Open — needs discussion]'); expect(text).toContain('NOT CONSENSUS');
  expect(JSON.stringify(source)).toBe(before);
});
test('workshop UI gates sharing and clears consent without network writes', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/verify-workshop-ui.tsx'], { stdout: 'pipe', stderr: 'pipe' });
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  expect({ code, stdout, stderr }).toEqual({ code: 0, stdout: 'PASS workshop consent and summary\n', stderr: '' });
});
