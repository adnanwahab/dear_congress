/** Isolated React DOM + real HTTP journey. This does not verify browser rendering. */
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const testDirectory = await mkdtemp(join(tmpdir(), 'civic-proposals-ui-'));
const child = Bun.spawn([process.execPath, 'server.ts'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { PATH: process.env.PATH ?? '', PORT: '0', DB_PATH: join(testDirectory, 'db.json'), NODE_ENV: 'production', ANON_COOKIE_SECRET: 'isolated-ui-cookie-secret-at-least-32-characters', DEBUG_REQUEST_LOGS: '0', OPENAI_API_KEY: '', GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '' },
  stdin: 'ignore', stdout: 'pipe', stderr: 'pipe',
});
let startup = '';
const startupReader = child.stdout.getReader();
const decoder = new TextDecoder();
let base = '';
while (!base) {
  const { done, value } = await startupReader.read();
  if (done) throw new Error('Server stopped before ready: ' + startup);
  startup += decoder.decode(value);
  const match = startup.match(/running at (https?:\/\/\S+)/);
  if (match) { const url = new URL(match[1]!); url.hostname = '127.0.0.1'; base = url.origin; }
}
async function drainReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try { while (!(await reader.read()).done) {} }
  finally { reader.releaseLock(); }
}
const drain = Promise.all([drainReader(startupReader), drainReader(child.stderr.getReader())]);
const nativeFetch = globalThis.fetch;
const dom = new Window({ url: base + '/votes', settings: { disableJavaScriptFileLoading: true, navigation: { disableMainFrameNavigation: true } } });
for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLFormElement','HTMLSelectElement','Element','Node','Event','MouseEvent','CustomEvent','MutationObserver','localStorage','sessionStorage','location']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? dom : (dom as any)[key] });
}
Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: dom.getComputedStyle.bind(dom) });
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let dropNextPublishResponse = false;
let browserCookie = "";
globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input), dom.location.href);
  const headers = new Headers(init?.headers);
  if (browserCookie) headers.set('cookie', browserCookie);
  const response = await nativeFetch(url, { ...init, headers });
  const issued = response.headers.get('set-cookie')?.split(';')[0];
  if (issued) browserCookie = issued;
  if (dropNextPublishResponse && url.pathname === '/api/citizen-proposals' && init?.method === 'POST') {
    dropNextPublishResponse = false;
    throw new TypeError('Simulated lost publication response');
  }
  return response;
}) as any;
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { within, fireEvent } = await import('@testing-library/dom');
const { CitizenProposalsApp } = await import('../src/client/CitizenProposals.tsx');
let root: ReturnType<typeof createRoot> | null = null;
const checks: string[] = [];
const check = (name: string) => { checks.push(name); console.log('PASS ' + name); };
const query = () => within(document.body);
const pause = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean, label: string) {
  for (let n = 0; n < 300; n++) {
    if (predicate()) return;
    await act(async () => { await pause(); });
  }
  throw new Error('Timed out: ' + label + '\n' + document.body.textContent);
}
async function render(path: string) {
  if (root) await act(async () => { root!.unmount(); });
  dom.happyDOM.setURL(new URL(path, base).href);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById('root')!);
  await act(async () => { root!.render(React.createElement(CitizenProposalsApp)); });
}
async function fill(id: string, value: string) {
  await act(async () => { fireEvent.change(document.getElementById(id)!, { target: { value } }); });
}
async function click(name: string | RegExp) {
  await act(async () => { fireEvent.click(query().getByRole('button', { name })); });
}
async function confirmAndPublish() {
  await act(async () => { fireEvent.click(query().getByRole('checkbox')); });
  await click('Publish for advisory voting');
}
const api = async (path: string) => (await nativeFetch(base + path)).json() as Promise<any>;
try {
  await render('/votes');
  await until(() => !!query().queryByRole('heading', { name: 'Be the first to put a change forward.' }), 'empty state');
  check('Empty voting board has a visible proposal entry point');
  await render('/proposals/new');
  await fill('proposal-title', 'Publish one clear permit checklist');
  await fill('proposal-problem', 'Applicants have to piece together requirements from several offices.');
  await fill('proposal-change', 'Publish one checklist and processing times for common permits.');
  await fill('proposal-jurisdiction', 'city');
  await fill('proposal-place', 'Houston');
  await fill('proposal-info', 'Consult applicants and staff. Cost still needs an estimate.');
  await click('Save draft');
  assert.ok(document.body.textContent!.includes('Draft saved in this browser. It has not been published.'));
  const savedURL = dom.location.href;
  assert.match(savedURL, /draft=/);
  assert.equal((await api('/api/citizen-proposals')).proposals.length, 0);
  await render(savedURL);
  assert.equal((document.getElementById('proposal-title') as HTMLInputElement).value, 'Publish one clear permit checklist');
  assert.equal((document.getElementById('proposal-place') as HTMLInputElement).value, 'Houston');
  check('Draft persists across editor remount and is absent from public API');
  assert.equal((query().getByRole('button', { name: 'Publish for advisory voting' }) as HTMLButtonElement).disabled, true);
  await confirmAndPublish();
  await until(() => dom.location.pathname.startsWith('/proposals/citizen_'), 'publish navigation');
  const detailPath = dom.location.pathname;
  const id = detailPath.split('/').pop();
  assert.equal((await api('/api/citizen-proposals/' + id)).proposal.countTotal, 0);
  await render(detailPath);
  await until(() => !!query().queryByRole('heading', { name: 'Publish one clear permit checklist' }), 'detail');
  check('Publication requires confirmation and creates a permanent page without an automatic vote');
  await click(/^Support 0$/);
  await until(() => !!query().queryByText('Your advisory response is saved: Support.'), 'support');
  await click(/^Oppose 0$/);
  await until(() => !!query().queryByText('Your advisory response is saved: Oppose.'), 'oppose');
  await click('Remove my response');
  await until(() => !!query().queryByText('Your response was removed.'), 'remove');
  assert.equal((await api('/api/citizen-proposals/' + id)).proposal.countTotal, 0);
  check('Rendered vote buttons support replacement and removal without double counting');
  const firstCookie = browserCookie;
  browserCookie = ''; // Simulate a separate browser cookie jar.
  await render(detailPath);
  await until(() => !!query().queryByRole('button', { name: /^Support 0$/ }), 'second browser');
  await click(/^Support 0$/);
  await until(() => !!query().queryByText('Your advisory response is saved: Support.'), 'second support');
  browserCookie = firstCookie;
  await render(detailPath);
  await until(() => !!query().queryByRole('button', { name: /^Support 1$/ }), 'first browser shared counts');
  assert.equal(query().getByRole('button', { name: /^Support 1$/ }).getAttribute('aria-pressed'), 'false');
  check('Independent browser identity sees shared totals and its own choice');
  await fill('comment-name', 'Demo participant');
  await fill('comment-text', 'Could the checklist include expected processing times? <img src=x onerror=alert(1)>');
  await click('Post public comment');
  await until(() => !!query().queryByText('Your comment is published.'), 'comment');
  assert.equal(document.querySelectorAll('img').length, 0);
  assert.equal((document.getElementById('comment-text') as HTMLTextAreaElement).value, '');
  check('Public discussion posts, clears on success, and renders submitted markup as plain text');
  await render('/feed');
  await until(() => !!query().queryByRole('heading', { name: 'Publish one clear permit checklist' }), 'feed');
  await act(async () => { fireEvent.change(query().getByRole('searchbox'), { target: { value: 'no-match-value' } }); });
  assert.ok(query().getByRole('heading', { name: 'No proposals match those filters.' }));
  await click('Clear filters');
  assert.ok(query().getByRole('heading', { name: 'Publish one clear permit checklist' }));
  check('Published proposal appears in the searchable feed');
  const { entries } = await api('/api/entries');
  const entry = entries[0];
  await render('/proposals/new?fromJournal=' + encodeURIComponent(entry.id));
  await until(() => (document.getElementById('proposal-problem') as HTMLTextAreaElement)?.value === entry.text.slice(0, 5000), 'journal prefill');
  assert.equal((document.getElementById('proposal-change') as HTMLTextAreaElement).value, '');
  assert.equal((await api('/api/citizen-proposals')).proposals.length, 1);
  check('Journal conversion pre-fills the problem without publication or automatic policy text');
  await click('Save draft');
  const journalDraftURL = dom.location.href;
  const resetResponse = await nativeFetch(base + '/api/reset', { method: 'POST' });
  assert.equal(resetResponse.status, 200);
  await render(journalDraftURL);
  await fill('proposal-title', 'Keep a proposal after its source is removed');
  await fill('proposal-change', 'Retain the copied experience and allow review without a stale link.');
  await confirmAndPublish();
  await until(() => !!query().queryByRole('alert'), 'missing journal source rejection');
  assert.ok(query().getByRole('alert').textContent?.includes('source journal entry was not found'));
  await click('Remove journal link');
  assert.equal((document.getElementById('proposal-problem') as HTMLTextAreaElement).value, entry.text.slice(0, 5000));
  await click('Publish for advisory voting');
  await until(() => dom.location.pathname.startsWith('/proposals/citizen_'), 'publish after removing stale source');
  const recoveredSourceId = dom.location.pathname.split('/').pop();
  assert.equal((await api('/api/citizen-proposals/' + recoveredSourceId)).proposal.sourceEntryId, undefined);
  check('A saved draft can remove a missing journal link and publish without losing its text');
  await render('/proposals/does-not-exist');
  await until(() => !!query().queryByRole('heading', { name: 'Proposal not found.' }), '404');
  check('Unknown proposal shows a recoverable not-found page');
  const beforeRecovery = (await api('/api/citizen-proposals')).proposals.length;
  await render('/proposals/new');
  await fill('proposal-title', 'Recover a publication after a lost response');
  await fill('proposal-problem', 'A request can succeed while its response is lost.');
  await fill('proposal-change', 'Retain the same draft and retry identity across a reload.');
  dropNextPublishResponse = true;
  await confirmAndPublish();
  await until(() => !!query().queryByRole('alert'), 'lost response');
  const recoveryURL = dom.location.href;
  assert.match(recoveryURL, /draft=/);
  assert.equal((await api('/api/citizen-proposals')).proposals.length, beforeRecovery + 1);
  await render(recoveryURL);
  assert.equal((document.getElementById('proposal-title') as HTMLInputElement).value, 'Recover a publication after a lost response');
  await confirmAndPublish();
  await until(() => dom.location.pathname.startsWith('/proposals/citizen_'), 'retried publication');
  assert.equal((await api('/api/citizen-proposals')).proposals.length, beforeRecovery + 1);
  check('Lost publication response can be recovered after reload without creating a duplicate');
  console.log(JSON.stringify({ passed: checks.length }));
} finally {
  if (root) await act(async () => root!.unmount());
  await dom.happyDOM.close();
  globalThis.fetch = nativeFetch;
  child.kill('SIGTERM');
  await child.exited;
  await drain;
  await rm(testDirectory, { recursive: true, force: true });
}
