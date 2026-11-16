/** Fictional records only. Never use these as a source of civic verification. */
export type ProjectEvidence = {
  id: string;
  revision: string;
  kind: 'milestone' | 'implementation' | 'update';
  title: string;
  publishedOn: string;
  observedOn: string | null;
  verification: 'demo';
};
export type LocalProject = {
  id: string;
  revision: string;
  name: string;
  neighborhood: string;
  point: readonly [number, number];
  state: 'progress' | 'stalled' | 'unknown';
  stateReason: string;
  evidence: readonly ProjectEvidence[];
  prediction: { text: string; madeOn: string } | null;
};
export const PROJECT_AS_OF = '2026-11-14';
export const DEMO_PROJECTS: readonly LocalProject[] = [
  {
    id: 'demo-shade', revision: '1', name: 'Library shade walk', neighborhood: 'Example North', point: [100, 110],
    state: 'progress', stateReason: 'The fictional site log records two shade structures installed. This does not establish completion.',
    evidence: [
      { id: 'demo-shade-plan', revision: '1', kind: 'implementation', title: 'Fictional implementation plan: three shade structures', publishedOn: '2026-10-01', observedOn: null, verification: 'demo' },
      { id: 'demo-shade-m1', revision: '1', kind: 'milestone', title: 'Fictional milestone: foundations complete', publishedOn: '2026-10-21', observedOn: '2026-10-20', verification: 'demo' },
      { id: 'demo-shade-log', revision: '1', kind: 'update', title: 'Fictional site log: two structures installed', publishedOn: '2026-11-12', observedOn: '2026-11-11', verification: 'demo' },
    ],
    prediction: { text: 'Example planner expects a third structure in December. Timing and benefits are unverified.', madeOn: '2026-11-12' },
  },
  {
    id: 'demo-crossing', revision: '1', name: 'Safer school crossing', neighborhood: 'Example Central', point: [260, 180],
    state: 'stalled', stateReason: 'A fictional project notice explicitly pauses construction for a permit review. Silence alone is not evidence of a stall.',
    evidence: [{ id: 'demo-crossing-pause', revision: '1', kind: 'update', title: 'Fictional notice: work paused pending permit review', publishedOn: '2026-10-02', observedOn: '2026-10-02', verification: 'demo' }],
    prediction: null,
  },
  {
    id: 'demo-garden', revision: '1', name: 'Community garden path', neighborhood: 'Example South', point: [180, 280],
    state: 'unknown', stateReason: 'No implementation document or observed update is available. A published intention does not prove work began.',
    evidence: [{ id: 'demo-garden-m1', revision: '1', kind: 'milestone', title: 'Fictional published goal: accessible garden path', publishedOn: '2026-09-01', observedOn: null, verification: 'demo' }],
    prediction: null,
  },
];
export function updateFreshness(evidence: ProjectEvidence, asOf = PROJECT_AS_OF): string {
  if (!evidence.observedOn) return 'No observation recorded';
  const age = (Date.parse(asOf) - Date.parse(evidence.observedOn)) / 86400000;
  return age < 0 || !Number.isFinite(age) ? 'Observation date unknown' : age <= 30 ? 'Recent example observation' : 'Old example observation (over 30 days)';
}
export type DemoCorrection = {
  id: string;
  projectId: string;
  projectRevision: string;
  evidenceId: string;
  evidenceRevision: string;
  text: string;
  source: string;
  status: 'pending';
  origin: 'demo';
};
/** Append-only rehearsal queue; no operation mutates the evidence records. */
export function queueDemoCorrection(queue: readonly DemoCorrection[], projectId: string, evidenceId: string, text: string, source: string): DemoCorrection[] {
  const project = DEMO_PROJECTS.find(p => p.id === projectId);
  const evidence = project?.evidence.find(e => e.id === evidenceId);
  if (!project || !evidence) throw new Error('Select an evidence record for this project.');
  if (!text.trim() || text.length > 2000) throw new Error('Enter a correction of 1–2,000 characters.');
  let url: URL;
  try { url = new URL(source.trim()); } catch { throw new Error('Provide a public HTTPS source URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Provide a public HTTPS source URL without credentials.');
  return [...queue, { id: `demo-correction-${queue.length + 1}`, projectId, projectRevision: project.revision, evidenceId, evidenceRevision: evidence.revision, text: text.trim(), source: url.href, status: 'pending', origin: 'demo' }];
}
