import { expect, test } from 'bun:test';
import { createErrorTelemetry } from './error-telemetry';

test('error observation discards personal paths, payloads and thrown values', async () => {
  const records: object[] = [];
  const telemetry = createErrorTelemetry(['/api/journal/:id'], row => records.push(row));
  const failure = await telemetry.observe('/api/journal/:id', () => { throw new Error('private journal politics'); });
  expect(failure.status).toBe(500);
  expect(failure.headers.get('x-route-template')).toBe('/api/journal/:id');
  await telemetry.observe('/private-person?token=secret', () => new Response('private body', { status: 404 }));
  await telemetry.observe('/api/journal/:id', () => new Response('ok'));
  expect(records).toHaveLength(2);
  expect(JSON.stringify([records, telemetry.snapshot()])).not.toMatch(/private|secret|politics/);
  expect(telemetry.snapshot().failures).toEqual([
    { routeTemplate: '/api/journal/:id', status: 500, count: 1 },
    { routeTemplate: 'unmatched', status: 404, count: 1 },
  ]);
});

test('broken telemetry sink cannot fail the response', async () => {
  const telemetry = createErrorTelemetry(['/api/votes'], () => { throw Error('sink'); });
  const response = await telemetry.observe('/api/votes', () => new Response('try later', { status: 503 }));
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('try later');
});

test('browser version split is bounded, rejects unknown fields and raw URLs', () => {
  const records: object[] = [];
  const telemetry = createErrorTelemetry([], row => records.push(row));
  const report = { buildSha: 'a'.repeat(40), routeTemplate: '/proposals/:id', category: 'error' };
  expect(telemetry.browserReport({ ...report, message: 'private' })).toBe(false);
  expect(telemetry.browserReport({ ...report, routeTemplate: '/proposals/personal?secret' })).toBe(false);
  expect(telemetry.browserReport({ ...report, buildSha: 'private' })).toBe(false);
  expect(telemetry.browserReport(report)).toBe(true);
  expect(telemetry.browserReport({ ...report, buildSha: 'b'.repeat(40) })).toBe(true);
  expect(telemetry.snapshot().browserFailures.map(row => row.buildSha)).toEqual(['a'.repeat(40), 'b'.repeat(40)]);
  for (let i = 0; i < 18; i++) expect(telemetry.browserReport({ ...report, buildSha: i.toString(16).padStart(40, '0') })).toBe(true);
  expect(telemetry.browserReport({ ...report, buildSha: 'c'.repeat(40) })).toBe(false);
  expect(records).toHaveLength(20);
});
