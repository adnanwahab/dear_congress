import { useState } from 'react';
import type { LiveSnapshot } from '../server/live-rounds';
import type { QuestionAction } from '../server/live-questions';

export function LiveQuestionBoard({ board, moderator, ended, busy, send }: {
  board: LiveSnapshot['board']; moderator: boolean; ended: boolean; busy: boolean;
  send: (action: QuestionAction) => Promise<boolean>;
}) {
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [receipt, setReceipt] = useState('');
  const [groups, setGroups] = useState<Record<string,string>>({});
  const current = board.questions.find(q => q.id === board.current && q.status === 'approved');
  return <section className="live-question-board" aria-labelledby="question-board-title">
    <h2 id="question-board-title">Audience question wall</h2>
    <p>Discussion about this fictional sample only. Questions and upvotes are not civic election votes, verified attendance or verified civic participation. Display names are self-described.</p>
    <p>Questions wait for presenter review before appearing publicly. Approved text and optional names are public to anyone with this link; avoid private information. This temporary board disappears on server restart.</p>
    <div aria-live="polite" aria-atomic="true"><h3>On screen</h3>{current ? <blockquote>{current.text}<footer>{current.author || 'Anonymous'} · {current.duplicates} grouped submission{current.duplicates === 1 ? '' : 's'}</footer></blockquote> : <p>No question on screen.</p>}</div>
    {moderator && <><p>Review text and names for abuse or private information. Approving matching questions groups them automatically; use the group selector for differently worded duplicates; the first approved wording and name remain. Reports are advisory browser signals for your review.</p><button disabled={busy || ended || !board.questions.some(q => q.status === 'approved')} onClick={() => void send({kind:'next'})}>Show next question fairly</button><p>Each approved group gets equal turns, least shown first, regardless of upvotes. Rotation is manual; no automatic motion.</p></>}
    {!moderator && <form onSubmit={async event => {
      event.preventDefault();
      if (await send({kind:'submit', text, author:author || undefined})) { setText(''); setAuthor(''); setReceipt('Question sent for presenter review. It is not public until approved.'); }
    }}>
      <label htmlFor="live-question-text">Your question (500 characters maximum)</label>
      <textarea id="live-question-text" required maxLength={500} value={text} disabled={busy || ended} onChange={e => {setText(e.target.value);setReceipt('');}} />
      <label htmlFor="live-question-author">Display name (optional; leave blank for anonymous)</label>
      <input id="live-question-author" maxLength={60} value={author} disabled={busy || ended} onChange={e => setAuthor(e.target.value)} />
      <p>At most five submissions per browser per round. Anonymous means no display name; a signed browser cookie still limits abuse.</p>
      <button disabled={busy || ended || !text.trim()} type="submit">Send question for review</button>
      <p role="status">{receipt}</p>
    </form>}
    <h3>{moderator ? 'Moderation queue and approved questions' : 'Approved questions'}</h3>
    {!board.questions.length && <p>{moderator ? 'No questions yet.' : 'No approved questions yet.'}</p>}
    <ul>{board.questions.map(q => <li key={q.id}>
      <p>{q.text}</p><p>{q.author || 'Anonymous'} · {q.status} · {q.duplicates} grouped · {q.upvotes} discussion upvotes</p>
      {moderator ? <><p>{q.reports ?? 0} reports · {q.shown} screen turns</p>{q.status === 'pending' && <><label htmlFor={'group-'+q.id}>Group duplicate question</label><select id={'group-'+q.id} disabled={busy || ended} value={groups[q.id] || ''} onChange={event=>setGroups({...groups,[q.id]:event.target.value})}><option value="">Automatic exact match or new group</option>{board.questions.filter(other=>other.status === 'approved').map(other=><option key={other.id} value={other.id}>{other.text}</option>)}</select><button disabled={busy || ended} onClick={() => void send({kind:'approve',id:q.id,groupId:groups[q.id] || undefined})}>Approve question</button></>}<button disabled={busy || ended} onClick={() => void send({kind:'hide',id:q.id})}>Hide question</button></> : <><button disabled={busy || ended || q.upvoted} onClick={() => void send({kind:'upvote',id:q.id})}>{q.upvoted ? 'Upvoted' : 'Upvote question'}</button><button disabled={busy || ended || q.reported} onClick={() => void send({kind:'report',id:q.id})}>{q.reported ? 'Reported for review' : 'Report abuse'}</button></>}
    </li>)}</ul>
    {ended && <p>Round ended. Questions and moderation are frozen.</p>}
  </section>;
}
