/** Only call for exact entries in the build manifest, never filename-pattern matches. */
export function assetResponse(req: Request, asset: Blob, immutable: boolean): Response {
  const headers = new Headers({
    'content-type': asset.type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  // The manifest URL is content-versioned; use it as a validator without reading the body.
  headers.set('etag', `"${new URL(req.url).pathname.split('/').pop()}"`);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD', 'cache-control': 'no-store' } });
  }
  const tags = req.headers.get('if-none-match')?.split(',').map(tag => tag.trim().replace(/^W\//, ''));
  if (tags?.includes(headers.get('etag')!) || tags?.includes('*')) return new Response(null, { status: 304, headers });
  return new Response(req.method === 'HEAD' ? null : asset, { headers });
}
