// Coarse templates deliberately omit topic, bill, proposal and repository identifiers.
const pages = new Set(['/', '/journal', '/journals', '/needs', '/votes', '/vote', '/feed', '/synth', '/map', '/account', '/privacy', '/outcomes', '/documentation', '/docs', '/proposals/new', '/published', '/draft', '/sponsors', '/embed', '/bills', '/topics', '/api-docs']);
export const browserErrorRoutes = new Set([...pages, '/proposals/:id', '/bills/:id', '/topics/:id', '/live/:id', '/vote/:repository', '/vote/:repository/:kind/:number', 'unmatched']);
export function errorRoute(pathname: string): string {
  if (pages.has(pathname)) return pathname;
  for (const [pattern, template] of [
    [/^\/proposals\/[^/]+$/, '/proposals/:id'], [/^\/bills\/[^/]+$/, '/bills/:id'],
    [/^\/topics\/[^/]+$/, '/topics/:id'], [/^\/live\/[^/]+$/, '/live/:id'],
    [/^\/vote\/[^/]+$/, '/vote/:repository'], [/^\/vote\/[^/]+\/(pr|issue)\/\d+$/, '/vote/:repository/:kind/:number'],
  ] as const) if (pattern.test(pathname)) return template;
  return 'unmatched';
}
