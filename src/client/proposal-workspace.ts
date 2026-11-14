import type { ProposalJurisdiction } from '../shared/citizen-proposals';

export const WORKSPACE_KEY = 'civic_synthesis_private_proposal_workspace_v1';
export const PROCESS_TEMPLATES: Record<ProposalJurisdiction, string> = {
  city: 'City ordinance outline: identify the council process, public hearing requirements and implementing department.',
  county: 'County action outline: identify the governing body, delegated powers and public meeting process.',
  state: 'State bill outline: verify legislative sponsorship, committee review and enactment requirements.',
  federal: 'Federal bill outline: verify congressional sponsorship, committee review and enactment requirements.',
  unsure: 'Choose a jurisdiction and verify its process with a human reviewer.',
};
export const WORKSPACE_FIELDS = {
  title: 'Title', problem: 'Problem statement', affected: 'Affected people', benefit: 'Intended benefit',
  mechanism: 'Policy mechanism', authority: 'Who could enact it (unverified)', costs: 'Costs, funding and uncertainty',
  objections: 'Objections and responses', sources: 'Source links (one HTTP or HTTPS URL per line)', text: 'Editable proposed new text',
} as const;
export type WorkspaceField = keyof typeof WORKSPACE_FIELDS;
export type WorkspaceValues = Record<WorkspaceField, string> & { jurisdiction: ProposalJurisdiction };
export interface WorkspaceDraft { version: 1; id: string; savedAt: string; values: WorkspaceValues }
export function blankWorkspace(): WorkspaceValues {
  return { jurisdiction: 'unsure', ...Object.fromEntries(Object.keys(WORKSPACE_FIELDS).map(key => [key, ''])) } as WorkspaceValues;
}
export function readWorkspace(raw: string | null): WorkspaceDraft | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.version !== 1 || typeof value.id !== 'string' || typeof value.savedAt !== 'string'
    || !value.values || !Object.hasOwn(PROCESS_TEMPLATES, value.values.jurisdiction)
    || Object.keys(WORKSPACE_FIELDS).some(key => typeof value.values[key] !== 'string' || value.values[key].length > 10000)) {
    throw new Error('Saved workspace is unreadable. Keep a copy before clearing browser storage.');
  }
  return value;
}
export function workspaceGaps(values: WorkspaceValues): { field: keyof WorkspaceValues; message: string }[] {
  const gaps: { field: keyof WorkspaceValues; message: string }[] = [];
  if (values.jurisdiction === 'unsure') gaps.push({ field: 'jurisdiction', message: 'Choose a jurisdiction; authority still needs human verification.' });
  for (const field of Object.keys(WORKSPACE_FIELDS) as WorkspaceField[]) {
    if (!values[field].trim()) gaps.push({ field, message: `Add ${WORKSPACE_FIELDS[field].toLowerCase()}.` });
  }
  if (values.sources.trim() && values.sources.split('\n').filter(s => s.trim()).some(source => {
    try { const url = new URL(source.trim()); return !['http:', 'https:'].includes(url.protocol) || !!url.username || !!url.password; }
    catch { return true; }
  })) gaps.push({ field: 'sources', message: 'Use complete HTTP or HTTPS source URLs without embedded credentials.' });
  return gaps;
}
export function workspaceSummary(values: WorkspaceValues): string {
  return `${values.problem || '[Problem missing]'}\n\nProposed change: ${values.mechanism || '[Mechanism missing]'}\n\nIntended benefit: ${values.benefit || '[Benefit missing]'}`;
}
export function workspaceOutline(values: WorkspaceValues): string {
  return [
    ['Citizen-authored draft', values.title], ['Jurisdiction', values.jurisdiction], ['Findings', values.problem],
    ['Scope / affected people', values.affected], ['Intended benefit', values.benefit], ['Mechanism', values.mechanism],
    ['Implementation / unverified authority', values.authority], ['Costs and uncertainty', values.costs],
    ['Objections', values.objections], ['Sources / not verified', values.sources], ['Proposed new text / no verified baseline', values.text],
  ].map(([label, text]) => `${label}\n${text || '[Missing — needs review]'}`).join('\n\n');
}
