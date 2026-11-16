import { expect, test } from 'bun:test';
import { allowedRequest, publicOrigin } from './synthetic-probes';

test('public firewall blocks writes and off-origin redirects/telemetry', () => {
  const origin = 'https://civic-synthesis.fly.dev';
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    expect(allowedRequest(origin, `${origin}/api/votes`, method)).toBe(false);
  }
  expect(allowedRequest(origin, `${origin}/feed`, 'GET')).toBe(true);
  expect(allowedRequest(origin, 'https://other.example/feed', 'GET')).toBe(false);
});
test('public target must be a bare secure origin', () => {
  expect(publicOrigin('https://civic-synthesis.fly.dev')).toBe('https://civic-synthesis.fly.dev');
  for (const value of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/feed', 'https://example.com/?key=secret']) {
    expect(() => publicOrigin(value)).toThrow();
  }
});
