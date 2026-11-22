import { describe, expect, test } from 'bun:test';
import { serveVisualDemo, VISUAL_DEMOS, VISUAL_DEMO_CSP } from './visual-demos';

describe('read-only, opaque-origin visual demos', () => {
  test('every demo has a checked-in backing HTML file', async () => {
    for (const filename of Object.values(VISUAL_DEMOS)) {
      const file = Bun.file(new URL(`../../public/civic-visual-stories/${filename}`, import.meta.url));
      expect(await file.exists()).toBe(true);
      expect((await file.text()).toLowerCase()).toContain('<html');
    }
  });

  test('enforces sandbox even when a demo is opened in its own tab', async () => {
    const response = serveVisualDemo('world');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('content-security-policy')).toBe(VISUAL_DEMO_CSP);
    expect(VISUAL_DEMO_CSP).toContain('sandbox allow-scripts');
    expect(VISUAL_DEMO_CSP).not.toContain('allow-same-origin');
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect((await response.text())).toContain('CIVIC SYNTHESIS');
  });

  test('serves the consensus grid world map', async () => {
    const response = serveVisualDemo('consensus');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe(VISUAL_DEMO_CSP);
    const html = await response.text();
    expect(html).toContain('CIVIC SYNTHESIS');
    expect(html).toContain('not recorded votes');
  });

  test('rejects traversal, unknown names, and methods that could write', () => {
    expect(serveVisualDemo('../server.ts').status).toBe(404);
    expect(serveVisualDemo('world/../../server.ts').status).toBe(404);
    expect(serveVisualDemo('missing').status).toBe(404);
    expect(serveVisualDemo('latency', 'POST').status).toBe(405);
    expect(serveVisualDemo('latency', 'HEAD').body).toBeNull();
  });
});
