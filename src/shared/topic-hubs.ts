import { TOPICS, topicForNeed } from './topics';
import type { JournalEntry, NeedDef, Proposal } from '../engine/types';
import { isPublicEntry } from './moderation';

export const topicById = (id: string) => TOPICS.find(t => t.id === id);
export function topicHub(id: string, needs: NeedDef[], proposals: Proposal[], entries: JournalEntry[]) {
  const topic = topicById(id);
  if (!topic) return null;
  const selected = needs.filter(n => topicForNeed(n.label) === topic.label);
  const needIds = new Set(selected.map(n => n.id));
  // Only repository sample stories are eligible. Legacy public human records do
  // not retain curation consent. Never infer topics from the original prose.
  const stories = entries.filter(e => e.seeded === true && !e.synthetic && isPublicEntry(e)
    && e.extraction.needs.some(n => needIds.has(n.id))).map(e => ({
      id: e.id, text: e.text,
      needIds: e.extraction.needs.filter(n => needIds.has(n.id)).map(n => n.id),
      proposalIds: e.extraction.proposalIds.filter(id => proposals.some(p => p.id === id && needIds.has(p.needId))),
    }));
  return { topic, needs: selected.map(({ id, label, goal, metric }) => ({ id, label, goal, metric })), stories,
    proposals: proposals.filter(p => !p.emergent && needIds.has(p.needId)).map(({ id, needId, title, jurisdiction, rightsIssue }) => ({ id, needId, title, jurisdiction, rightsIssue })) };
}
export type TopicHubData = NonNullable<ReturnType<typeof topicHub>>;
export function topicStageUrl(stage: string, topic: string, proposal?: string) {
  const query = new URLSearchParams({ topic });
  if (proposal) query.set('proposal', proposal);
  return `/${stage}?${query}`;
}
