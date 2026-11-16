import { useState } from 'react';
import archive from '../shared/redline-card-archive.json';
import type { DemoItem } from '../engine/demo';

export const cardStatus = 'Fictional demo · not quoted law, enacted law or legal advice. Independently operated, non-binding beta; no governmental authority.';
export const cardLink = (revision: string) => `/draft?card=${revision}`;
export function cardText(card: typeof archive[number]) {
  return `${card.title}\nJurisdiction: ${card.jurisdiction} (sample scope; no verified legal applicability)\n${cardStatus}\nSource: ${card.repository} · ${card.kind} · ${card.id}\nDraft revision: sha256:${card.revision}\nBefore (illustrative): ${card.before}\nAfter (proposed): ${card.after}\nBackground only: ${card.backgroundUrl}\n${card.background.scope}\nLink: ${cardLink(card.revision)}`;
}
export function RedlineCard({ revision }: { revision: string }) {
  const card = archive.find(row => row.revision === revision);
  const [status, setStatus] = useState('');
  if (!card) return <main className="panel"><h1>Draft revision unavailable</h1><p>This link does not identify an archived card. Current text has not been substituted.</p><a href="/draft">Browse current sample drafts</a></main>;
  const text = cardText(card);
  return <article className="panel" aria-label="Revision-pinned policy redline card" style={{ overflowWrap: 'anywhere' }}>
    <h1>{card.title}</h1><p>{cardStatus}</p>
    <p>Jurisdiction: {card.jurisdiction} (sample scope; no verified legal applicability)</p>
    <p>Source: {card.repository} · {card.kind} · {card.id}</p><p>Exact draft revision: <code>sha256:{card.revision}</code></p>
    <h2>Before · illustrative, not quoted law</h2><p>{card.before}</p>
    <h2>After · proposed demo text</h2><p>{card.after}</p>
    <p>Background only: <a href={card.backgroundUrl}>{card.background.name}</a>. {card.background.scope}. This reference does not substantiate the fictional clauses.</p>
    <p><a href={cardLink(card.revision)}>Permanent revision link</a></p>
    <details><summary>Selectable share text and accessibility description</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{text}</pre><p>Use this complete text as alt text if you capture the card as an image.</p></details>
    <button onClick={async () => { try { await navigator.clipboard.writeText(text.replace(`Link: ${cardLink(card.revision)}`, `Link: ${new URL(cardLink(card.revision), window.location.origin).href}`)); setStatus('Card text copied.'); } catch { setStatus('Copy unavailable. Select the share text above.'); } }}>Copy card text</button><p role="status">{status}</p>
    <a href="/draft">Browse current drafts</a>
  </article>;
}
export function RedlineShareLink({ item }: { item: DemoItem }) {
  const card = archive.find(row => row.id === item.id && row.title === item.title && row.jurisdiction === item.jurisdiction && row.before === item.currentText && row.after === item.proposedText && row.backgroundUrl === item.sourceUrl && JSON.stringify(row.background) === JSON.stringify(item.background));
  return card ? <p><a href={cardLink(card.revision)}>Open revision-pinned share card</a> · Fictional demo text; no publication or vote.</p> : <p>No archived share card for this exact draft revision.</p>;
}
