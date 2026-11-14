import { expect, test } from 'bun:test';
import { discoverJournal } from '../shared/journal-discovery';
import type { JournalEntry } from '../engine/types';
import { SharedJournalFeed } from './SharedJournalFeed';
import { renderToStaticMarkup } from 'react-dom/server';
const entry = (id: string, extra: Partial<JournalEntry> = {}): JournalEntry => ({ id, author: 'A', text: 'Public excerpt', createdAt: '2026-11-13T12:00:00Z', corrected: false, extraction: { needs: [{ id: 'food', confidence: 1 }], importance: .5, constraints: [], concerns: [], proposalIds: [] }, ...extra });
test('origin, needs and UTC dates filter before pagination without mutation', () => {
 const entries = [entry('real'), entry('sample', { seeded: true }), entry('sim', { synthetic: true }), entry('older', { createdAt: '2026-11-12T23:59:59Z' })];
 const before = JSON.stringify(entries);
 const result = discoverJournal(entries, new URLSearchParams('need=food&from=2026-11-13&to=2026-11-13'));
 expect(result.map(e => e.id)).toEqual(['real']);
 expect(discoverJournal(entries, new URLSearchParams('origin=sample')).map(e => e.id)).toEqual(['sample']);
 expect(discoverJournal(entries, new URLSearchParams('origin=simulated')).map(e => e.id)).toEqual(['sim']);
 expect(discoverJournal(entries, new URLSearchParams('need=housing'))).toEqual([]);
 expect(() => discoverJournal(entries, new URLSearchParams('from=2026-02-30'))).toThrow();
 expect(JSON.stringify(entries)).toBe(before);
});
test('originals have stable links, explicit timezone, origin and accessible empty state', () => {
 const html = renderToStaticMarkup(<SharedJournalFeed entries={[entry('one')]} needs={[]} loading={false} />);
 expect(html).toContain('/journal?entry=one'); expect(html).toContain('UTC'); expect(html).toContain('dateTime="2026-11-13T12:00:00Z"'); expect(html).toContain('Public submission');
 expect(renderToStaticMarkup(<SharedJournalFeed entries={[]} needs={[]} loading={false} />)).toContain('No public experiences match');
});
test('browse restores URL state, paginates and recovers offline without public writes', async () => {
 const { Window } = await import('happy-dom'); const dom = new Window({ url: 'https://civic.test/journal?origin=sample&need=food' });
 const globals = { window: dom, document: dom.document, location: dom.location, navigator: dom.navigator, FormData: dom.FormData, IS_REACT_ACT_ENVIRONMENT: true };
 const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
 for (const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis,k,{configurable:true,value:v});
 const { act } = await import('react'); const { createRoot } = await import('react-dom/client'); const { within, fireEvent } = await import('@testing-library/dom'); const { default: Screen } = await import('./JournalScreen');
 const host = document.body.appendChild(document.createElement('div')); const root = createRoot(host); const calls: string[] = []; let offline = false;
 const request = async <T,>(path:string, body?:unknown): Promise<T> => { expect(body).toBeUndefined(); calls.push(path); if(path.includes('schema')) return { needs:[{id:'food',label:'Food'}] } as T; if(offline) throw Error('offline'); return { entries: [], nextCursor: path.includes('cursor') ? null : 'next' } as T; };
 const q = within(host);
 try {
 await act(async()=>root.render(<Screen request={request}/>));
 expect(calls.at(-1)).toBeDefined(); expect(calls.some(p=>p.includes('origin=sample') && p.includes('need=food'))).toBe(true);
 expect(q.getByLabelText('Origin').tagName).toBe('SELECT');
 await act(async()=>fireEvent.click(q.getByRole('button',{name:'Next page'})));
 expect(location.search).toContain('cursor=next'); expect(location.search).toContain('need=food');
 offline=true;
 await act(async()=>{ dom.history.replaceState(null,'','/journal?origin=public'); dom.dispatchEvent(new dom.PopStateEvent('popstate')); });
 expect(q.getByRole('alert').textContent).toContain('Check your connection');
 offline=false; await act(async()=>fireEvent.click(q.getByRole('button',{name:'Retry loading'})));
 expect(q.queryByRole('alert')).toBeNull();
 await act(async()=>fireEvent.submit(q.getByRole('form',{name:'Browse public experiences'})));
 expect(location.search).toContain('origin=public');
 } finally { await act(async()=>root.unmount()); for(const k of Object.keys(globals)) { if(previous[k]) Object.defineProperty(globalThis,k,previous[k]!); else Reflect.deleteProperty(globalThis,k); } await dom.happyDOM.close(); }
});
