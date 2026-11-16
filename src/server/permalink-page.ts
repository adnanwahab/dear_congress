import { createHash } from 'node:crypto';
import snapshots from '../generated/sample-permalinks.json';
import { readBills } from './legislation/import';
import { escapeHTML, metadata } from './pages';
import { officialPermalink } from '../shared/permalinks';

/** Read-only public detail; no browser state, writes or React bootstrap. */
export async function permalinkPage(shell: string, path: string, root: string): Promise<Response | null> {
  if (!path.startsWith('/samples/') && !path.startsWith('/official-records/')) return null;
  let title = '', body = '';
  const e = escapeHTML;
  const snapshot = snapshots.find(s => `/samples/${encodeURIComponent(s.item.id)}/${s.revision}` === path);
  const sample = snapshot?.item;
  if (sample) {
    title = sample.title;
    const revision = createHash('sha256').update(JSON.stringify(sample)).digest('hex');
    body = `<p>Fictional sample scenario / not introduced bill. Non-binding beta, independently operated.</p><p>Source repository: adnanwahab/dear_congress · kind: sample scenario</p><p>Revision SHA-256: ${revision}</p><p>${e(sample.summary)}</p><h2>Current sample text</h2><p>${e(sample.currentText)}</p><h2>Proposed sample text</h2><p>${e(sample.proposedText)}</p><h2>Background only</h2><p>Source not available / not checked. Background does not establish official text.</p><p>${e(sample.background?.name ?? 'Unavailable')} · ${e(sample.background?.publisher ?? 'Unavailable')}</p><p>${e(sample.background?.scope ?? 'Scope unknown')}</p><p>${e(sample.sourceUrl)}</p><a href="/votes?proposal=${encodeURIComponent(sample.id)}">Explore advisory options</a>`;
  } else if (/^\/official-records\/[^/]+\/[a-f0-9]{64}$/.test(path)) {
    const revision = path.split('/').at(-1)!;
    try {
      const bill = (await readBills(root, revision)).find(b => officialPermalink(b.id, b.sourceHash) === path);
      if (bill) {
        title = bill.title;
        body = `<p>Official source metadata only. Full text, amendments, current legal status and measured outcomes unverified.</p><p>Source repository: adnanwahab/dear_congress · kind: Congress.gov metadata</p><p>${e(bill.id)} · Revision SHA-256: ${bill.sourceHash}</p><p>Metadata retrieved ${e(bill.checkedAt)}. Historical snapshot; not a live status check.</p><p>${e(bill.latestAction.actionDate)}: ${e(bill.latestAction.text)}</p><p>Sponsors: ${e(bill.sponsors.join('; '))}</p><a href="${e(bill.sourceUrl)}">Congress.gov source</a>`;
      }
    } catch {
      return new Response('Official metadata archive unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  const found = !!title;
  title ||= 'Page not found';
  body ||= '<p>No record with this source identity and revision is available.</p>';
  const html = shell.replace(/<title>[^<]*<\/title>/, metadata(title, title, path))
    .replace('<div id="root"></div>', `<main style="max-width:48rem;margin:4rem auto;padding:1rem;overflow-wrap:anywhere"><h1>${e(title)}</h1>${body}<p><a href="/feed">Return to Feed</a> · <a href="/privacy">Privacy &amp; removal</a></p></main>`)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  return new Response(html, { status: found ? 200 : 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
