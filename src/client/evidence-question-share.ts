/** Public, immutable citizen proposal fields only. Never spread a response object. */
export interface QuestionProposal { id: string; title: string; supportingInfo?: string; }
export const QUESTION_LIMIT = 400;
export function citationLinks(info = ''): string[] {
  return [...new Set((info.match(/https?:\/\/[^\s<>"']+/giu) ?? []).flatMap(raw => {
    try {
      const url = new URL(raw.replace(/[.,;!?)}\]]+$/u, ''));
      return url.protocol === 'https:' && !url.username && !url.password ? [url.href] : [];
    } catch { return []; }
  }))];
}
export function sharedQuestion(search: string): string {
  const question = new URLSearchParams(search).get('evidenceQuestion') ?? '';
  return question.trim().slice(0, QUESTION_LIMIT);
}
export function evidenceQuestionShare(proposal: QuestionProposal, question: string, origin: string) {
  const clean = question.trim();
  if (!clean || clean.length > QUESTION_LIMIT) throw new Error('Enter an open factual question of 1–400 characters.');
  const url = new URL(`/proposals/${encodeURIComponent(proposal.id)}`, origin);
  url.searchParams.set('evidenceQuestion', clean);
  url.hash = 'evidence';
  const citations = citationLinks(proposal.supportingInfo);
  return [
    'Civic Synthesis · Independently operated, non-binding beta · no governmental authority.',
    `Open factual question (selected by the sharer; unresolved status not verified): ${clean}`,
    `Original citizen proposal: ${proposal.title}`,
    `Source repository: adnanwahab/dear_congress · kind: citizen proposal · ID: ${proposal.id}`,
    citations.length ? `Available citations (author-supplied links; not verified):\n${citations.join('\n')}` : 'Available citations: no safe HTTPS citation links supplied. Supporting notes may still be available on the proposal.',
    `Read the question and evidence: ${url.href}`,
  ].join('\n\n');
}
