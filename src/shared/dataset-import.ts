/** Local review packets only; no packet is authority to publish observations. */
export const CLAIM_KINDS = ['primary source', 'editorial inference', 'user claim', 'synthetic estimate'] as const;
export type ClaimKind = typeof CLAIM_KINDS[number];
export type Mapping = { value: string; period: string; unit: string; scope: string };
export type ImportDraft = {
  csv: string; mapping: Mapping; metric: string; expectedUnit: string; expectedScope: string;
  kind: ClaimKind; publisher: string; source: string; version: string; license: string;
  licenseUrl: string; retrieved: string; limitations: string;
};
export type ReviewPacket = { schema: 'civic-dataset-review.v1'; repository: 'adnanwahab/dear_congress';
  draft: ImportDraft; reviewer: string; reviewedAt: string; state: 'locally accepted'; published: false };
export function httpsUrl(value: string) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
const date = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export function parseCsv(csv: string): string[][] {
  if (csv.length > 100_000) throw new Error('CSV exceeds 100,000 characters. Split the file before review.');
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const pushCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]!;
    if (quoted) { if (c === '"') { if (csv[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === ',' || c === '\n' || c === '\r') {
      pushCell(); if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (c === '\r' && csv[i + 1] === '\n') i++; }
    } else if (c === '"' && !cell && !closed) quoted = true;
    else { if (closed || c === '"') throw new Error('Malformed CSV quoting.'); cell += c; }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  pushCell(); if (row.some(Boolean)) rows.push(row);
  const headers = rows[0];
  if (!headers || rows.length < 2) throw new Error('Include a header and at least one observation.');
  headers[0] = headers[0]!.replace(/^\uFEFF/, '');
  if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('Headers must be unique and nonempty.');
  if (rows.length > 501) throw new Error('Review at most 500 observations at a time.');
  if (rows.some(r => r.length !== headers.length)) throw new Error('Each row must match the header width.');
  return rows;
}
export function validateImport(draft: ImportDraft, today = new Date().toISOString().slice(0, 10)) {
  const errors: string[] = []; let rows: string[][] = [];
  try { rows = parseCsv(draft.csv); } catch (e) { errors.push((e as Error).message); }
  for (const field of ['metric', 'expectedUnit', 'expectedScope', 'publisher', 'version', 'license', 'limitations'] as const)
    if (!draft[field].trim()) errors.push(`Required: ${field}.`);
  if (!httpsUrl(draft.source)) errors.push('Provenance requires an HTTPS source URL.');
  if (!httpsUrl(draft.licenseUrl)) errors.push('License requires an HTTPS terms URL.');
  if (!date(draft.retrieved) || draft.retrieved > today) errors.push('Retrieval date must be a real date, no later than today.');
  if (draft.kind !== 'primary source') errors.push('Only primary-source observations can pass official-feed validation.');
  const headers = rows[0] ?? [];
  const indices = (['value', 'period', 'unit', 'scope'] as const).map(k => headers.indexOf(draft.mapping[k]));
  if (indices.some(i => i < 0) || new Set(indices).size !== 4) errors.push('Map four distinct columns: value, period, unit and scope.');
  else {
    const [v, p, u, s] = indices as [number, number, number, number]; const seen = new Set<string>();
    rows.slice(1).forEach((r, i) => {
      const prefix = `Row ${i + 2}: `;
      if (!r[v] || !/^-?(?:\d+\.?\d*|\.\d+)$/.test(r[v]!) || !Number.isFinite(Number(r[v]))) errors.push(prefix + 'value must be a finite number, not a missing marker.');
      if (!date(r[p]!) || r[p]! > draft.retrieved) errors.push(prefix + 'period must be a valid date on or before retrieval.');
      if (r[u] !== draft.expectedUnit) errors.push(prefix + 'unit conflicts with metric contract.');
      if (r[s] !== draft.expectedScope) errors.push(prefix + 'scope conflicts with metric contract.');
      const key = JSON.stringify([r[p], r[u], r[s]]);
      if (seen.has(key)) errors.push(prefix + 'duplicate/conflicting observation; resolve upstream before acceptance.');
      seen.add(key);
    });
  }
  return { rows, errors };
}
export function acceptImport(draft: ImportDraft, reviewer: string, confirmed: boolean, now = new Date().toISOString()): ReviewPacket {
  if (validateImport(draft, now.slice(0, 10)).errors.length || !reviewer.trim() || !confirmed) throw new Error('Resolve validation and confirm source, license, unit and scope review.');
  return { schema: 'civic-dataset-review.v1', repository: 'adnanwahab/dear_congress', draft: structuredClone(draft), reviewer: reviewer.trim(), reviewedAt: now, state: 'locally accepted', published: false };
}
export const EMPTY_IMPORT: ImportDraft = {
  csv: 'value,period,unit,scope\n', mapping: { value: 'value', period: 'period', unit: 'unit', scope: 'scope' },
  metric: '', expectedUnit: '', expectedScope: '', kind: 'primary source', publisher: '', source: '', version: '', license: '', licenseUrl: '', retrieved: '', limitations: '',
};

/** Citation-complete specimen, not a fetched or independently verified source snapshot. */
export const IMPORT_EXAMPLES: Record<string, ImportDraft> = {
  'Sourced specimen': { ...EMPTY_IMPORT, csv: 'value,period,unit,scope\n331449281,2020-04-01,persons,United States resident population', metric: 'US resident population (2020 Census)', expectedUnit: 'persons', expectedScope: 'United States resident population', publisher: 'U.S. Census Bureau', source: 'https://www.census.gov/library/stories/2021/04/2020-census-data-release.html', version: '2020 Census apportionment release, April 26 2021; US resident population', license: 'Census Bureau public-domain data; reviewer must confirm applicable terms', licenseUrl: 'https://www.census.gov/about/policies/citation.html', retrieved: '', limitations: 'Manually transcribed specimen; source was not fetched by this workbench. Verify against the original release before accepting. Decennial resident count excludes overseas populations; not a policy effect or current population estimate.' },
  'Conflicting specimen': { ...EMPTY_IMPORT, csv: 'value,period,unit,scope\n10,2020-04-01,percent,Other population\n20,2020-04-01,percent,Other population', metric: 'Conflict demonstration', expectedUnit: 'persons', expectedScope: 'United States resident population', kind: 'synthetic estimate', limitations: 'Invented conflicting rows for validation testing.' },
  'Missing-source specimen': { ...EMPTY_IMPORT, csv: 'value,period,unit,scope\n10,2020-04-01,persons,Unknown population', metric: 'Unsupported claim demonstration', expectedUnit: 'persons', expectedScope: 'Unknown population', kind: 'user claim', limitations: 'Invented unsupported claim; no source supplied.' },
};
