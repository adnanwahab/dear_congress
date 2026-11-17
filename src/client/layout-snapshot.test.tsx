import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { Window } from 'happy-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { LayoutSnapshotExport } from './LayoutSnapshotExport';
import { createLayoutSnapshot, exhibitRows, EXHIBIT_NOTICE } from './layout-snapshot';

for (const size of ['phone', 'wide'] as const) test(`${size} fixed-seed repeat exports preserve all data and versions`, async () => {
  const a = await createLayoutSnapshot(size), b = await createLayoutSnapshot(size);
  expect(a).toEqual(b);
  // Deliberate visual format changes require reviewing and updating these byte snapshots.
  const expected = size === 'phone'
    ? ['a9b795987931e1a76405d57f0228a161899656ff58998c153fe51801391b32b9', 'ad817159418cb505b50e01a9e46231bbb015b626538b3457b3ec7d97290dd550']
    : ['32029f466f6f532db50fbbaf5f9a2188b32899efd653893f96a9300001eaf605', '04fbb12af9f557551dae03f796956b5c7c3075f226a9cd4276008a40de8c0e88'];
  expect([a.svg, a.html].map(bytes => createHash('sha256').update(bytes).digest('hex'))).toEqual(expected);
  expect(a.manifest.seed).toBe(42);
  expect(a.manifest.repository).toBe('adnanwahab/dear_congress');
  expect(a.manifest.itemKind).toBe('public-sample-need-catalog');
  expect(a.manifest.datasetVersion).toBe(`sha256:${createHash('sha256').update(JSON.stringify(exhibitRows())).digest('hex')}`);
  const window = new Window();
  try {
    const doc = new window.DOMParser().parseFromString(a.html, 'text/html');
    expect(doc.querySelectorAll('li')).toHaveLength(exhibitRows().length);
    expect(JSON.parse(doc.querySelector('pre')!.textContent)).toEqual(JSON.parse(a.json));
    const svg = new window.DOMParser().parseFromString(a.svg, 'image/svg+xml');
    expect(JSON.parse(svg.querySelector('metadata')!.textContent)).toEqual(a.manifest);
    for (const row of exhibitRows()) {
      const item = [...doc.querySelectorAll('li')].find(li => li.textContent.includes(`ID: ${row.id}`))!;
      for (const field of Object.values(row)) expect(item.textContent).toContain(field);
    }
    const text = [...svg.querySelectorAll('text')].map(n => n.textContent).join('');
    for (const row of exhibitRows()) for (const field of Object.values(row)) expect(text.replace(/\s/g, '')).toContain(field.replace(/\s/g, ''));
    expect(svg.querySelector('svg')!.getAttribute('viewBox')).toStartWith(`0 0 ${a.manifest.viewport.width} `);
    for (const node of svg.querySelectorAll('text')) expect(node.textContent.length).toBeLessThanOrEqual(Math.floor((a.manifest.viewport.width - 48) / 9));
    expect(doc.querySelectorAll('script,iframe,input,form,img')).toHaveLength(0);
    expect(doc.querySelector('h1')!.textContent).toContain('SAMPLE');
  } finally { await window.happyDOM.close(); }
});

test('size affects only layout; exports exclude incidental personal fields', async () => {
  const phone = await createLayoutSnapshot('phone'), wide = await createLayoutSnapshot('wide');
  expect(phone.manifest.rows).toEqual(wide.manifest.rows);
  expect(phone.manifest.datasetVersion).toBe(wide.manifest.datasetVersion);
  for (const row of phone.manifest.rows) expect(Object.keys(row)).toEqual(['id', 'label', 'goal', 'metric', 'level']);
  expect(phone.json).not.toMatch(/journal|author|cookie|voter|allocation|draft|keywords/i);
  await expect(createLayoutSnapshot('bad' as any)).rejects.toThrow('Unknown exhibit size');
});

test('static fallback and native controls expose the same sample data without motion or storage', () => {
  const html = renderToStaticMarkup(<LayoutSnapshotExport />);
  expect(html).toContain('role="status"');
  expect(html).toContain('<select'); expect(html).toContain('type="button"');
  expect(html).toContain('Sample description and download fallback');
  expect(html).toContain('browser Print');
  for (const row of exhibitRows()) expect(html).toContain(row.id);
  expect(html).toContain(EXHIBIT_NOTICE);
});

test('preparing, changing size, and failed downloads preserve drafts and offer recovery', async () => {
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const window = new Window();
  const globals = { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  let count = 0;
  URL.createObjectURL = () => `blob:exhibit-${++count}`;
  URL.revokeObjectURL = url => { revoked.push(url); };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const host = document.createElement('div'); document.body.append(host);
  const draft = document.createElement('textarea'); draft.value = 'Private unsent draft'; document.body.append(draft);
  window.localStorage.setItem('draft', 'Private stored draft');
  const root = createRoot(host);
  const prepare = async () => { await act(async () => { host.querySelector('button')!.click(); await new Promise(r => setTimeout(r, 15)); }); };
  try {
    await act(async () => root.render(<LayoutSnapshotExport />));
    await prepare();
    expect(host.querySelectorAll('a[download]')).toHaveLength(3);
    expect(host.querySelector('[role=status]')!.textContent).toContain('Ready');
    const select = host.querySelector('select')!;
    await act(async () => { select.value = 'wide'; select.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); });
    expect(host.querySelectorAll('a[download]')).toHaveLength(0);
    expect(revoked).toHaveLength(3);
    await prepare();
    expect(host.querySelector('a[download]')!.getAttribute('download')).toBe('civic-sample-wide-v1.svg');
    URL.createObjectURL = () => { throw Error('Downloads blocked'); };
    await prepare();
    expect(host.querySelector('[role=status]')!.textContent).toContain('Download unavailable');
    expect(host.querySelector('button')!.disabled).toBe(false);
    expect(host.querySelectorAll('a[download]')).toHaveLength(0);
    expect(draft.value).toBe('Private unsent draft');
    expect(window.localStorage.getItem('draft')).toBe('Private stored draft');
    expect(host.textContent).not.toContain('Private');
  } finally {
    await act(async () => root.unmount());
    URL.createObjectURL = create; URL.revokeObjectURL = revoke;
    for (const key of Object.keys(globals)) { if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!); else Reflect.deleteProperty(globalThis, key); }
    await window.happyDOM.close();
  }
});
