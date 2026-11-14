import { journalOrigin } from '../shared/journal-discovery';
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
      <div className="journal-entry-meta"><strong>{e.author || 'Participant'}</strong><time dateTime={e.createdAt}>{Number.isNaN(Date.parse(e.createdAt)) ? 'Date unavailable' : new Date(e.createdAt).toLocaleString('en-US', { timeZone: 'UTC', timeZoneName: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>
      <span className="sample-tag">{journalOrigin(e) === 'public' ? 'Public submission' : journalOrigin(e) === 'sample' ? 'Sample' : 'Simulated'}</span><span> · {Date.parse(e.createdAt) <= Date.now() && Date.parse(e.createdAt) >= Date.now() - 7 * 86400000 ? 'Posted in the past 7 days' : 'Outside the past 7 days or date unavailable'}</span><a href={`/journal?entry=${encodeURIComponent(e.id)}`}>Permalink</a><p>{e.text}</p>
      <div className="journal-need-tags">{e.extraction.needs.map((n, index) => <a key={n.id} href={needUrl(n.id, e.id)} style={isNew ? { animationDelay: `${motionDuration(260 + index * 160)}ms`, viewTransitionName: needTransitionName(n.id) } : undefined}>{needs.find(v => v.id === n.id)?.label ?? n.id}<span className="journal-need-link"> · See it in Needs →</span></a>)}</div>
    </article>;
  }
  return <>
    <div className="panel-head"><h2>Shared journal</h2><span>{loading ? <Skeleton kind="line" /> : `${entries.length} loaded`}</span></div>
    <p className="muted">Original experiences, with their attached need labels.</p>
    <div className="journal-feed" aria-busy={loading}>{loading && !entries.length && <Skeleton kind="list" />}{groupJournalEntries(entries).map(group => <div className="journal-story-group" key={group[0]!.id}>
      {story(group[0]!)}
      {group.length > 1 && <details className="journal-similar"><summary>+{group.length - 1} similar {group.length === 2 ? 'story' : 'stories'} from simulated residents</summary>{group.slice(1).map(story)}</details>}
    </div>)}{!loading && !entries.length && <p className="empty-feed">No public experiences match this view. Adjust the filters or clear them. A linked entry may be unavailable or removed.</p>}</div>
  </>;
}
