import { expect, test } from 'bun:test';
import { DEMO_ITEMS } from '../engine/demo';
import { proposalEmbed } from './proposal-embed';
const request = (query = '', method = 'GET') => new Request('https://example.test/embed/v1' + query, { method });
test('anonymous versioned card preserves sample identity and background provenance without executable content', async () => {
  const response = proposalEmbed(request('?proposal=demo-housing'));
  const html = await response.text();
  expect(response.status).toBe(200);
  for (const text of ['Fictional demo', 'read-only', 'Embed v1', DEMO_ITEMS[0]!.summary, 'City of Houston', 'Not checked', '/feed?proposal=demo-housing']) expect(html).toContain(text);
  expect(html).not.toMatch(/<script|<form|<button|<iframe|localStorage|fetch\(/);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('content-security-policy')).toContain("connect-src 'none'");
  expect(response.headers.get('content-security-policy')).toContain('sandbox allow-popups allow-popups-to-escape-sandbox');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});
test('index, empty, unavailable and HEAD are accessible static responses', async () => {
  expect(await proposalEmbed(request()).text()).toContain('?proposal=demo-housing');
  expect(await proposalEmbed(request(), []).text()).toContain('No sample proposals available');
  expect(proposalEmbed(request('?proposal=unknown')).status).toBe(404);
  expect(await proposalEmbed(request('?proposal=demo-housing', 'HEAD')).text()).toBe('');
});
test('untrusted metadata cannot inject markup or a source navigation', async () => {
  const html = await proposalEmbed(request('?proposal=demo-housing'), [{ ...DEMO_ITEMS[0]!, title: '<script>alert(1)</script>', sourceUrl: 'javascript:alert(1)' }]).text();
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain('Source unavailable');
});
test('public arguments retain both sides, uncertainty and sample revision isolation', async () => {
  const html = await proposalEmbed(request('?proposal=demo-transit')).text();
  for (const text of ['Source label:', 'Transit planning', 'demo-transit', 'Reasons for', 'Concerns', 'Counterargument:', 'Evidence missing:', 'unverified assertions', 'No governmental authority']) expect(html).toContain(text);
  expect(html).not.toMatch(/<script|<form|<button|<img|<link|<iframe/);
  const transit = DEMO_ITEMS.find(item => item.id === 'demo-transit')!;
  const changed = await proposalEmbed(request('?proposal=demo-transit'), [{ ...transit, proposedText: 'Changed revision' }]).text();
  expect(changed).toContain('No arguments available for this sample revision.');
  expect(changed).not.toContain('More frequent evening service');
  const housing = await proposalEmbed(request('?proposal=demo-housing')).text();
  expect(housing).toContain('No arguments available for this sample revision.');
});
