import { useEffect, useState } from 'react';
import type { PublicPull, PullDetail, PullList } from '../shared/hbl-governance';

export const REVIEW_TABS = ['summary', 'files', 'checks'] as const;
type Tab = typeof REVIEW_TABS[number];
type Receipt = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; detail: PullDetail };
export function PatchCarousel({ list, api, base }: { list: PullList; api: string; base: string }) {
  const read = () => {
    const params = new URLSearchParams(window.location.search);
    const number = Number(params.get('review'));
    return { number: Number.isSafeInteger(number) && number > 0 ? number : list.pulls[0]?.number, tab: REVIEW_TABS.includes(params.get('tab') as Tab) ? params.get('tab') as Tab : 'summary' as Tab };
  };
  const [selection, setSelection] = useState(read);
  const [receipt, setReceipt] = useState<Receipt>({ state: 'loading' });
  const selected = list.pulls.find(p => p.number === selection.number);
  useEffect(() => { const update = () => setSelection(read()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, [list]);
  useEffect(() => {
    let active = true;
    setReceipt({ state: 'loading' });
    if (!selected) return;
    fetch(`${api}/${selected.number}`, { credentials: 'same-origin' }).then(async response => {
      if (!response.ok) throw Error(response.status === 403 ? 'Permission denied. Sign in and refresh the source.' : 'Review source unavailable. Refresh to retry.');
      const detail = await response.json() as PullDetail;
      if (detail.pull.number !== selected.number || detail.pull.repositoryId !== selected.repositoryId || detail.pull.version !== selected.version || detail.pull.headSha !== selected.headSha || detail.pull.base !== selected.base || detail.pull.kind === 'issue') throw Error('Revision changed. Refresh the source before reviewing.');
      if (active) setReceipt({ state: 'ready', detail });
    }).catch(error => { if (active) setReceipt({ state: 'error', message: String(error.message) }); });
    return () => { active = false; };
  }, [api, selected]);
  function select(number: number | undefined, tab = selection.tab) {
    if (!number) return;
    const url = new URL(window.location.href); url.searchParams.set('review', String(number)); url.searchParams.set('tab', tab);
    window.history.pushState(null, '', url); setSelection({ number, tab });
  }
  const index = list.pulls.findIndex(p => p.number === selection.number);
  // Never display a previous selection's receipt while its replacement is loading.
  const pull = receipt.state === 'ready' && receipt.detail.pull.number === selected?.number && receipt.detail.pull.version === selected.version ? receipt.detail.pull : undefined;
  return <section className="gp-panel gp-carousel" aria-label="Patch review carousel" onKeyDown={event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.target as HTMLElement).closest('input, textarea, select, [contenteditable], [role=tablist]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault(); select(list.pulls[index + (event.key === 'ArrowRight' ? 1 : -1)]?.number);
  }} tabIndex={0}>
    <h2>Patch review carousel</h2><p>Use Left and Right arrows here to compare PRs. Browsing never casts a vote or authorizes a merge.</p>
    <nav aria-label="Compare pull requests"><button disabled={index <= 0} onClick={() => select(list.pulls[index - 1]?.number)}>Previous PR</button><span>{index >= 0 ? `${index + 1} of ${list.pulls.length}` : 'Selection unavailable'}</span><button disabled={index < 0 || index >= list.pulls.length - 1} onClick={() => select(list.pulls[index + 1]?.number)}>Next PR</button></nav>
    <p>Source: {list.repository} · {list.sourceStatus} · {list.stale ? 'Stale cached source' : 'Current source'} · Last sync: {list.lastSync ?? 'unknown'}</p>
    <p>{list.viewer.authenticated ? list.viewer.approved ? 'Approved roster member' : 'Signed in; roster approval required to participate' : 'Read-only visitor; sign in for verified participation'}</p>
    <div role="tablist" aria-label="Review sections">{REVIEW_TABS.map((tab, i) => <button key={tab} id={`review-${tab}`} role="tab" aria-controls="review-panel" aria-selected={selection.tab === tab} tabIndex={selection.tab === tab ? 0 : -1} onClick={() => select(selection.number, tab)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (i + 1) % 3 : event.key === 'ArrowLeft' ? (i + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
      if (next < 0) return; event.preventDefault(); select(selection.number, REVIEW_TABS[next]); document.getElementById(`review-${REVIEW_TABS[next]}`)?.focus();
    }}>{tab[0]!.toUpperCase() + tab.slice(1)}</button>)}</div>
    <div id="review-panel" role="tabpanel" aria-labelledby={`review-${selection.tab}`} tabIndex={0}>
      {!selected ? <p role="status">This PR is not in the available source list. Choose an available PR after refreshing.</p> : receipt.state === 'error' ? <p role="alert">{receipt.message}</p> : !pull ? <p role="status">Loading PR #{selected.number} review evidence…</p> : <>
        <h3 aria-live="polite">#{pull.number} {pull.title}</h3><p>{pull.eligibility.state}: {pull.eligibility.reason}</p>
        <p>Repository ID {pull.repositoryId} · Version <code>{pull.version}</code> · Head <code>{pull.headSha}</code> · Base {pull.base} <code>{pull.evidence?.baseSha ?? 'SHA unavailable'}</code></p>
        <p><a href={`${base}/pr/${pull.number}`}>Open PR details and explicit voting controls</a> · <a href={`https://github.com/${list.repository}/pull/${pull.number}`} target="_blank" rel="noopener noreferrer">Open GitHub PR ↗</a></p>
        {selection.tab === 'summary' && <p className="gp-raw">{pull.body || 'No description provided.'}</p>}
        {selection.tab === 'files' && (pull.files?.length ? pull.files.map(file => <details key={file.filename}><summary>{file.filename} · +{file.additions} −{file.deletions}</summary><pre className="gp-diff">{file.patch || 'Diff unavailable or truncated; open GitHub for the full change.'}</pre></details>) : <p>Files unavailable. Open GitHub for the complete change.</p>)}
        {selection.tab === 'checks' && <><p>GitHub-derived evidence; review readiness is not merge authorization.</p>{pull.evidence ? <><p>Mergeability: {pull.evidence.mergeableState} · Protections: {pull.evidence.protectionsKnown ? 'known' : 'unknown'}</p>{pull.evidence.checks.map((check, i) => <p key={i}>{check.name}: {check.status} / {check.conclusion ?? 'pending'} · SHA <code>{check.sha}</code></p>)}{!pull.evidence.checks.length && <p>No checks reported.</p>}{pull.evidence.reviews.map((review, i) => <p key={i}>Review: {review.state} · Commit <code>{review.commitId ?? 'unknown'}</code></p>)}</> : <p>Check and review evidence unavailable.</p>}</>}
      </>}
    </div>
  </section>;
}
