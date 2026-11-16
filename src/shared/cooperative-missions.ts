/** Same-device workshop contract. Names/permissions are self-declared, not authentication. */
export const MISSION_ROLES = ['research', 'cost', 'fairness', 'implementation'] as const;
export type MissionRole = typeof MISSION_ROLES[number];
export interface MissionSource { kind: 'sample' | 'citizen'; id: string; title: string; text: string }
export interface MissionMember { name: string; permission: 'editor' | 'observer'; role: MissionRole | '' }
export interface MissionContribution { member: string; role: MissionRole | ''; finding: string; citation: string; reasoning: string; limitation: string }
export type MissionAction =
  | { type: 'member'; member: MissionMember }
  | { type: 'draft'; text: string }
  | { type: 'contribution'; contribution: MissionContribution }
  | { type: 'review'; contribution: number; ready: boolean; reason: string }
  | { type: 'question'; text: string }
  | { type: 'resolve'; question: number; reason: string };
export interface MissionEvent { actor: string; at: string; action: MissionAction }
export interface Mission { version: 1; source: MissionSource; members: MissionMember[]; draft: string; contributions: MissionContribution[]; questions: { text: string; resolution: string }[]; log: MissionEvent[] }
export function newMission(source: MissionSource): Mission {
  return { version: 1, source: { ...source }, members: [{ name: 'Facilitator', permission: 'editor', role: '' }], draft: source.text, contributions: [], questions: [], log: [] };
}
function text(value: unknown, max = 10000): value is string { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function role(value: unknown): value is MissionRole | '' { return value === '' || MISSION_ROLES.includes(value as MissionRole); }
export function validCitation(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function applyMission(mission: Mission, event: MissionEvent): Mission {
  if (mission.log.length >= 300) throw new Error('Workshop log is full. Export it before starting another workshop.');
  const actor = mission.members.find(member => member.name === event.actor);
  if (actor?.permission !== 'editor') throw new Error('Only workshop editors can make changes.');
  if (!text(event.at, 40) || !Number.isFinite(Date.parse(event.at))) throw new Error('Invalid log date.');
  const next = structuredClone(mission);
  const action = event.action;
  switch (action.type) {
    case 'member': {
      if (event.actor !== 'Facilitator') throw new Error('Only the facilitator can assign workshop roles and permissions.');
      const member = action.member;
      if (!member || !text(member.name, 60) || member.name !== member.name.trim() || member.name === 'Facilitator' || !['editor', 'observer'].includes(member.permission) || !role(member.role)) throw new Error('Enter a participant name and valid permission/optional role.');
      const index = next.members.findIndex(m => m.name === member.name);
      if (index === -1 && next.members.length >= 6) throw new Error('Use a group of at most six participants.');
      if (index === -1) next.members.push({ ...member }); else next.members[index] = { ...member };
      break;
    }
    case 'draft':
      if (!text(action.text, 20000)) throw new Error('Draft text is required (up to 20,000 characters).');
      next.draft = action.text; break;
    case 'contribution': {
      const c = action.contribution;
      if (!c || c.member !== event.actor || c.role !== actor.role || !text(c.finding) || !text(c.reasoning) || !text(c.limitation) || !text(c.citation, 2000) || !validCitation(c.citation)) throw new Error('Add a finding, HTTP(S) citation, reasoning and a limitation. Citations remain unverified.');
      next.contributions.push({ ...c }); break;
    }
    case 'review':
      if (!Number.isInteger(action.contribution) || !next.contributions[action.contribution] || next.contributions[action.contribution]!.member === event.actor || typeof action.ready !== 'boolean' || !text(action.reason, 2000)) throw new Error('A different editor must review the contribution and explain source relevance, reasoning and limitations.');
      break;
    case 'question':
      if (!text(action.text, 2000)) throw new Error('Enter a question (up to 2,000 characters).');
      next.questions.push({ text: action.text, resolution: '' }); break;
    case 'resolve':
      if (!Number.isInteger(action.question) || !next.questions[action.question] || next.questions[action.question]!.resolution || !text(action.reason, 2000)) throw new Error('Select an unresolved question and explain its resolution.');
      next.questions[action.question]!.resolution = action.reason; break;
    default: throw new Error('Unknown workshop change.');
  }
  next.log.push(structuredClone(event));
  return next;
}
/** One milestone per role, with a reasoned review by another self-declared editor. */
export function missionProgress(mission: Mission): MissionRole[] {
  const lastDraft = mission.log.findLastIndex(e => e.action.type === 'draft');
  return MISSION_ROLES.filter(role => mission.contributions.some((c, index) => {
    const review = mission.log.slice(lastDraft + 1).filter(e => e.action.type === 'review' && e.action.contribution === index).at(-1)?.action;
    return c.role === role && review?.type === 'review' && review.ready && validCitation(c.citation);
  }));
}
export function readMission(raw: string | null, source: MissionSource): Mission {
  if (raw === null) return newMission(source);
  try {
    const value = JSON.parse(raw);
    if (value.version !== 1 || JSON.stringify(value.source) !== JSON.stringify(source) || !Array.isArray(value.log) || value.log.length > 300) throw new Error();
    // Replay the ledger instead of trusting mutable derived state.
    return value.log.reduce((mission: Mission, event: MissionEvent) => applyMission(mission, event), newMission(source));
  } catch { throw new Error('Saved workshop is unreadable or belongs to a different source revision. It has not been overwritten. Export or recover browser storage before continuing.'); }
}
export function missionKey(source: MissionSource): string { return `civic_cooperative_mission_v1:${source.kind}:${encodeURIComponent(source.id)}`; }
export function exportMission(mission: Mission): string {
  return JSON.stringify({ label: 'Same-device workshop; self-declared participants; unverified citations; no publication or voting authority', ...mission }, null, 2);
}
