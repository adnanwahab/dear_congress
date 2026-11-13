import type { JournalEntry } from '../engine/types';
import { Skeleton } from './LoadingSkeleton';
import { groupJournalEntries } from './journal-groups';
import { needTransitionName, needUrl } from './journal-motion';
import { motionDuration } from './motion';

type Props = { entries: JournalEntry[]; needs: { id: string; label: string }[]; loading: boolean; publishedId?: string };
export function SharedJournalFeed({ entries, needs, loading, publishedId }: Props) {
  function story(e: JournalEntry) {
    const isNew = publishedId === e.id;
    return <article key={e.id} id={`story-${e.id}`} tabIndex={-1} data-entry-id={e.id} className={isNew ? 'journal-story-new' : undefined}>
      <div className="journal-entry-meta"><strong>{e.author || 'Participant'}</strong><time dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
      <p>{e.text}</p>
      <div className="journal-need-tags">{e.extraction.needs.map((n, index) => <a key={n.id} href={needUrl(n.id, isNew ? e.id : undefined)} style={isNew ? { animationDelay: `${motionDuration(260 + index * 160)}ms`, viewTransitionName: needTransitionName(n.id) } : undefined}>{needs.find(v => v.id === n.id)?.label ?? n.id}<span className="journal-need-link"> · See it in Needs →</span></a>)}{(e.synthetic || e.seeded) && <span className="sample-tag">Sample</span>}</div>
    </article>;
  }
  return <>
    <div className="panel-head"><h2>Shared journal</h2><span>{loading ? <Skeleton kind="line" /> : `${entries.length} loaded`}</span></div>
    <p className="muted">Original experiences, with their attached need labels.</p>
    <div className="journal-feed">{loading && !entries.length && <Skeleton kind="list" />}{groupJournalEntries(entries).map(group => <div className="journal-story-group" key={group[0]!.id}>
      {story(group[0]!)}
      {group.length > 1 && <details className="journal-similar"><summary>+{group.length - 1} similar {group.length === 2 ? 'story' : 'stories'} from simulated residents</summary>{group.slice(1).map(story)}</details>}
    </div>)}{!loading && !entries.length && <p className="empty-feed">No experiences yet. Publish the first sample to begin.</p>}</div>
  </>;
}
