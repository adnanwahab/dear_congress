import { NEEDS } from '../engine/catalog';

export const EXHIBIT_SOURCE = 'https://github.com/adnanwahab/dear_congress/blob/main/src/engine/catalog.ts';
export const EXHIBIT_NOTICE = 'Sample educational catalog — illustrative goals, not measured outcomes, votes or official policy. Catalog ID order is not a priority ranking.';
// Explicit projection: never accept application state, a DOM tree, or user input.
export function exhibitRows() {
  return NEEDS.map(({ id, label, goal, metric, level }) => ({ id, label, goal, metric, level }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function lines(s: string, limit: number) {
  const result: string[] = [];
  for (const word of s.split(/\s+/).flatMap(word => word.match(new RegExp(`.{1,${limit}}`, 'gu')) ?? [])) {
    const last = result.length - 1;
    if (last < 0 || result[last]!.length + word.length + 1 > limit) result.push(word);
    else result[last] += ` ${word}`;
  }
  return result;
}
export async function createLayoutSnapshot(size: 'phone' | 'wide') {
  if (size !== 'phone' && size !== 'wide') throw new Error('Unknown exhibit size');
  const rows = exhibitRows();
  const dataset = JSON.stringify(rows);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataset)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const width = size === 'phone' ? 390 : 960;
  const manifest = {
    schema: 'dear-congress-layout-snapshot.v1', layoutVersion: 'catalog-layout.v1',
    repository: 'adnanwahab/dear_congress', itemKind: 'public-sample-need-catalog',
    source: EXHIBIT_SOURCE, datasetVersion: `sha256:${digest}`, seed: 42,
    seedPolicy: 'No randomized layout or data; seed 42 is fixed for repeat rendering.',
    viewport: { width, size }, order: 'id-ascending', sample: true,
    notice: EXHIBIT_NOTICE, rows,
  };
  const json = JSON.stringify(manifest, null, 2) + '\n';
  const chars = Math.floor((width - 48) / 9);
  let y = 36;
  const text = (value: string, bold = false) => lines(value, chars).map(line => {
    const node = `<text x="24" y="${y}"${bold ? ' font-weight="700"' : ''}>${escape(line)}</text>`;
    y += 24; return node;
  }).join('');
  let body = text('Public civic exhibit — SAMPLE', true) + text(EXHIBIT_NOTICE);
  for (const row of rows) {
    y += 20;
    body += text(`${row.label} [${row.id}]`, true) + text(`Goal: ${row.goal}`) + text(`Metric: ${row.metric}`) + text(`Scope: ${row.level}`);
  }
  y += 24;
  body += text(`Source: ${EXHIBIT_SOURCE}`) + text(`Dataset: sha256:${digest}`) + text('Layout: catalog-layout.v1; seed: 42');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${y + 24}" width="${width}" height="${y + 24}" role="img" aria-labelledby="title description"><title id="title">Public civic exhibit — sample catalog</title><desc id="description">${escape(EXHIBIT_NOTICE)} Full text and provenance are in the companion HTML description.</desc><metadata>${escape(json)}</metadata><rect width="100%" height="100%" fill="white"/><g fill="#17212b" font-family="monospace" font-size="15">${body}</g></svg>\n`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Public civic exhibit — sample catalog</title><style>body{font:1rem/1.6 system-ui,sans-serif;max-width:60rem;margin:auto;padding:1rem;color:#17212b;background:white;overflow-wrap:anywhere}li{margin-block:1.5rem}pre{white-space:pre-wrap}a{color:#154b83}</style></head><body><main><h1>Public civic exhibit — SAMPLE</h1><p>${escape(EXHIBIT_NOTICE)}</p><ul>${rows.map(row => `<li><h2>${escape(row.label)}</h2><p>ID: ${escape(row.id)}</p><p>Goal: ${escape(row.goal)}</p><p>Metric: ${escape(row.metric)}</p><p>Scope: ${escape(row.level)}</p></li>`).join('')}</ul><h2>Source and version manifest</h2><p><a href="${EXHIBIT_SOURCE}">Public sample catalog source</a>. The dataset digest identifies the exact exported fields; it is not a publisher signature. Seed 42; no animation or randomized order.</p><pre>${escape(json)}</pre></main></body></html>\n`;
  return { svg, html, json, manifest };
}
