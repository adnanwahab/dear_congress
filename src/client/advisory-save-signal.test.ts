import { expect, test } from 'bun:test';
import { advisoryFetch } from './advisory-save-signal';

test('save responses survive telemetry failure; intentional blocks and real failures remain separate', async () => {
  for (const [status, headers, expected] of [[200, {}, 'saved'], [403, {}, 'blocked'], [503, { 'x-service-outcome': 'blocked' }, 'blocked'], [503, {}, 'failed']] as const) {
    const reports: string[] = [];
    const send = (async (path: string | URL | Request, init?: RequestInit) => {
      if (path === '/api/save-outcome') { reports.push(String(init?.body)); throw Error('telemetry unavailable'); }
      return new Response('original', { status, headers });
    }) as typeof fetch;
    const response = await advisoryFetch('/api/votes', { method: 'POST', body: 'sensitive' }, send);
    expect(await response.text()).toBe('original'); expect(reports).toEqual([JSON.stringify({ outcome: expected })]);
  }
});
test('network failure reports once; abort and read requests do not report', async () => {
  for (const [method, name, count] of [['POST', 'Error', 1], ['POST', 'AbortError', 0], ['GET', 'Error', 0]] as const) {
    let reports = 0; const error = new Error('request failed'); error.name = name;
    const send = (async (path: string | URL | Request) => { if (path === '/api/save-outcome') { reports++; return new Response(); } throw error; }) as typeof fetch;
    await expect(advisoryFetch('/api/votes', { method }, send)).rejects.toBe(error); expect(reports).toBe(count);
  }
});
