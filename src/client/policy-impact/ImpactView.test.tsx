import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImpactView, localImpactLink, safeHblViewer, type ImpactViewData } from './ImpactView';
const remote = { id: `pp_${'a'.repeat(64)}`, url: `https://hbl.example/world/impact?preview=pp_${'a'.repeat(64)}` };
const data: ImpactViewData = {
  schemaVersion: 'policy-impact-preview.v1', proposalId: 'public-1', versionId: 'v2', baseVersionId: 'v1', contentHash: 'b'.repeat(64), title: 'Public draft', type: 'bill', legalStatus: 'unreviewed',
  clauses: [{clauseId: 'housing', sourcePolicyId: 'h_lots', operation: 'add', beforeText: '', afterText: '<img src=x onerror=alert(1)>\n  exact spacing'}],
  simulation: {seed: 42, runs: 100, months: 24}, supportStatus: 'supported', freshness: 'current', mappings: [], uncertainties: [], remote,
};
function render(patch: Partial<ImpactViewData> = {}) {
  return renderToStaticMarkup(<ImpactView data={{...data, ...patch}} permalink="/proposals/public-1/versions/2/impact?base=1" reviseUrl="/proposals/public-1/versions/2" versions={[{versionId: 'v1', label: 'Version 1', href: '/versions/1'}, {versionId:'v2', label:'Version 2', href:'/versions/2'}]} hblOrigin="https://hbl.example" civicOrigin="https://civic.example" allowedCivicOrigin="https://civic.example" />);
}
test('canonical returned HBL URL has exact origin, preview identity and no secret channels', () => {
  expect(safeHblViewer(remote, 'https://hbl.example')).toBe(remote.url);
  for (const url of [remote.url + '&token=secret', remote.url + '#secret', remote.url.replace('hbl.example', 'hbl.example.evil'), remote.url.replace('https:', 'http:'), remote.url.replace('/world/impact', '/elsewhere'), remote.url.replace('https://', 'https://user:secret@'), remote.url.replace('preview=', 'preview=%20'), remote.url + '&preview=x']) expect(safeHblViewer({...remote, url}, 'https://hbl.example')).toBeUndefined();
  expect(safeHblViewer({...remote, id: 'other'}, 'https://hbl.example')).toBeUndefined();
  expect(safeHblViewer(remote, 'https://hbl.example/path')).toBeUndefined();
});
test('navigation accepts Civic local paths and rejects external or executable URLs', () => {
  for (const path of ['javascript:alert(1)', '//evil.test', '/\\evil.test', '/\nevil.test', 'https://evil.test']) expect(localImpactLink(path)).toBeUndefined();
  expect(localImpactLink('/versions/1?base=0')).toBe('/versions/1?base=0');
});
test('exact text escapes hostile clauses; native version links and textual disclosures remain', () => {
  const html = render();
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;\n  exact spacing');
  expect(html).not.toContain('<img');
  expect(html).toContain('No data: no run has been requested');
  expect(html).toContain('aria-current="page"');
  expect(html).toContain('No modeled effect inferred');
  expect(html).toContain('Uncertainty data unavailable');
  expect(html).not.toContain('<iframe');
});
test('every remote job state remains explicit and frame never autoloads', () => {
  for (const status of ['queued','running','partial','completed','failed','unavailable'] as const) {
    const html = render({job: {status, completedPairs: 2, failedPairs: 1}});
    expect(html).toContain(`Job: ${status}.`);
    expect(html).toContain('Completed pairs: 2; failed pairs: 1');
    expect(html).not.toContain('<iframe');
    expect(html.includes('Load embedded simulator')).toBe(!['failed','unavailable'].includes(status));
  }
});
test('stale/revised source, unsupported amendment and invalid bounds do not offer current simulation', () => {
  for (const patch of [
    {freshness:'stale'}, {freshness:'revised-source'},
    {type:'constitutional-amendment', supportStatus:'unavailable'},
    {simulation: {seed:42, runs:101, months:24}}, {simulation: {seed:42, runs:1, months:25}},
  ] as Partial<ImpactViewData>[]) {
    const html = render({...patch, job: {status:'completed'}});
    expect(html).not.toContain('Open full simulator');
    expect(html).not.toContain('Load embedded simulator');
    expect(html).toContain('Exact legal redline');
  }
});

test('explicit frame loading, error fallback, revision reset and exact framing approval', async () => {
  const {Window} = await import('happy-dom');
  const {act} = await import('react');
  const browser = new Window({url:'https://civic.example'});
  const globals = {window:browser, document:browser.document, navigator:browser.navigator, IS_REACT_ACT_ENVIRONMENT:true};
  const previous = Object.fromEntries(Object.keys(globals).map(k => [k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for (const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
  const {createRoot} = await import('react-dom/client');
  const host = document.createElement('main'); document.body.append(host);
  const root = createRoot(host);
  const draw = (patch:Partial<ImpactViewData> = {}, allowed='https://civic.example', gpu?:boolean) => root.render(<ImpactView data={{...data, job:{status:'running'}, ...patch}} permalink="/impact" reviseUrl="/revise" versions={[]} hblOrigin="https://hbl.example" civicOrigin="https://civic.example" allowedCivicOrigin={allowed} gpuAvailable={gpu} />);
  const click = async (name:string) => { const b = Array.from(host.querySelectorAll('button')).find(b=>b.textContent===name); expect(b).toBeDefined(); await act(async()=>b!.click()); };
  try {
    await act(async()=>draw()); expect(host.querySelector('iframe') === null).toBe(true);
    await click('Load embedded simulator');
    expect(host.querySelector('iframe')?.getAttribute('src')).toBe(remote.url);
    expect(host.querySelector('iframe')?.getAttribute('referrerpolicy')).toBe('no-referrer');
    await act(async()=>host.querySelector('iframe')!.dispatchEvent(new browser.Event('error') as unknown as Event));
    expect(host.querySelector('iframe') === null).toBe(true); expect(host.textContent).toContain('Renderer or frame unavailable');
    await act(async()=>draw({versionId:'v3'}));
    await click('Load embedded simulator');
    await click('Use text fallback'); expect(host.querySelector('iframe') === null).toBe(true);
    await act(async()=>draw({versionId:'v4'}, 'https://other.example'));
    expect(host.textContent).not.toContain('Load embedded simulator');
    await act(async()=>draw({versionId:'v5'}, 'https://civic.example', false));
    expect(host.textContent).toContain('Renderer or frame unavailable');
    expect(host.querySelector('iframe') === null).toBe(true);
  } finally {
    await act(async()=>root.unmount()); browser.happyDOM.abort();
    for (const [k,v] of Object.entries(previous)) { if(v) Object.defineProperty(globalThis,k,v); else Reflect.deleteProperty(globalThis,k); }
  }
});
