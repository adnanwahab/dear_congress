import { getTopic, topicForNeed } from '../shared/topics';
import './topic-chip.css';

export function TopicChip({ topic }: { topic?: string }) {
  const identity = getTopic(topic);
  if (!identity) return null;
  return <span className="topic-chip" data-topic={identity.id} style={{ backgroundColor: identity.color }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={identity.icon} /></svg>
    <span>{identity.label}</span>
  </span>;
}
export function NeedTopicChip({ label }: { label: string }) { return <TopicChip topic={topicForNeed(label)} />; }
