/** Local rehearsal contracts only. Never use browser state as verification or publication authority. */
export interface OfficeHoursSource { repository: 'adnanwahab/dear_congress'; kind: 'sample'; id: string; revision: string }
export interface ExpertProfile {
  name: string; scope: string; verification: 'simulated-verified' | 'unverified';
  checkedBy: string; checkedAt: string; basis: string; conflicts: string;
}
export const SAMPLE_EXPERT: ExpertProfile = {
  name: 'Sample policy researcher (fictional)', scope: 'Proposal evaluation methods only',
  verification: 'simulated-verified', checkedBy: 'Fictional session moderator',
  checkedAt: '2026-11-14T12:00:00Z', basis: 'Simulated credential and identity review; no real credential checked',
  conflicts: 'Fictional disclosure: paid consultant to a policy research organization; no proposal sponsor relationship declared. Not independently verified.',
};
export interface AnswerRevision { text: string; citation: string; reason: string; at: string; kind: 'answer' | 'correction' | 'withdrawal' }
export interface QueueQuestion {
  id: number; text: string; at: string; status: 'pending' | 'approved' | 'declined';
  moderation?: { reason: string; at: string }; answers: AnswerRevision[];
}
export interface OfficeQueue { source: OfficeHoursSource; questions: QueueQuestion[] }
export type QueueAction =
  | { type: 'ask'; text: string; consent: boolean }
  | { type: 'moderate'; id: number; approve: boolean; reason: string }
  | { type: 'answer' | 'correction' | 'withdrawal'; id: number; text: string; citation: string; reason: string };
const clean = (value: string, max: number) => { const text = value.trim(); if (!text || text.length > max) throw new Error(`Enter text between 1 and ${max} characters.`); return text; };
export function updateQueue(queue: OfficeQueue, source: OfficeHoursSource, action: QueueAction, expert: ExpertProfile, at = new Date().toISOString()): OfficeQueue {
  if (JSON.stringify(queue.source) !== JSON.stringify(source)) throw new Error('Proposal revision changed. Reopen office hours for the current draft.');
  if (!Number.isFinite(Date.parse(at))) throw new Error('Invalid timestamp.');
  if (action.type === 'ask') {
    if (!action.consent) throw new Error('Confirm the local rehearsal consent first.');
    if (queue.questions.length >= 25) throw new Error('This rehearsal queue is full (25 questions).');
    return { ...queue, questions: [...queue.questions, { id: queue.questions.length + 1, text: clean(action.text, 1000), at, status: 'pending', answers: [] }] };
  }
  const question = queue.questions.find(q => q.id === action.id);
  if (!question) throw new Error('Question unavailable.');
  let next: QueueQuestion;
  if (action.type === 'moderate') {
    if (question.status !== 'pending') throw new Error('This question has already been moderated.');
    next = { ...question, status: action.approve ? 'approved' : 'declined', moderation: { reason: clean(action.reason, 1000), at } };
  } else {
    if (question.status !== 'approved') throw new Error('Only approved questions can receive answers.');
    if (expert.verification !== 'simulated-verified' || !expert.conflicts.trim() || !expert.basis.trim() || !expert.checkedBy.trim() || !expert.checkedAt.trim()) throw new Error('Verification and conflict disclosure are required.');
    const latest = question.answers.at(-1);
    if ((action.type === 'answer') !== !latest || latest?.kind === 'withdrawal') throw new Error('Use a correction for an existing answer; withdrawn answers stay withdrawn.');
    const revision: AnswerRevision = { kind: action.type, at, text: action.type === 'withdrawal' ? '' : clean(action.text, 3000), citation: action.type === 'withdrawal' ? '' : clean(action.citation, 2000), reason: action.type === 'answer' ? '' : clean(action.reason, 1000) };
    next = { ...question, answers: [...question.answers, revision] };
  }
  return { ...queue, questions: queue.questions.map(q => q.id === next.id ? next : q) };
}
