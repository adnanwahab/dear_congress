import { test } from 'bun:test';
import { checkSocialPreviews, previewProposals } from '../../scripts/social-preview-check';
import { renderPage } from './pages';

test('crawler preview matrix preserves titles, canonical identity, draft status and image bytes', async () => {
  const shell = await Bun.file(new URL('../../index.html', import.meta.url)).text();
  await checkSocialPreviews(async path => {
    const url = new URL(path, 'http://localhost');
    if (url.pathname === '/social-preview.png') return new Response(Bun.file(new URL('../../public/social-preview.png', import.meta.url)));
    return renderPage(shell, url.pathname, previewProposals);
  });
});
