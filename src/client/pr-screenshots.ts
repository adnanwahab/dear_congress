import type { PublicPull } from '../shared/hbl-governance';
import { REPOSITORIES } from '../shared/repository-voting';

export interface PullScreenshot { src: string; alt: string; commit: string }
/** PR text supplies pictures, never a trusted deployment or executable preview. */
export function attachedScreenshots(pull: Pick<PublicPull, 'url'|'number'|'body'|'kind'>): PullScreenshot[] {
  if (pull.kind === 'issue') return [];
  let repository: string;
  try {
    const source = new URL(pull.url);
    repository = source.pathname.split('/').slice(1, 3).join('/');
    if (source.protocol !== 'https:' || source.hostname !== 'github.com' || source.username || source.password || source.port ||
      source.pathname !== `/${repository}/pull/${pull.number}` || !Object.values(REPOSITORIES).some(r => r.repository === repository)) return [];
  } catch { return []; }
  const images: PullScreenshot[] = [], seen = new Set<string>();
  const pattern = /!\[([^\]\r\n]*)\]\(\s*<?(https:\/\/[^\s)>]+)>?(?:\s+"[^"]*")?\s*\)|<img\b[^>]*\bsrc\s*=\s*["'](https:\/\/[^"']+)["'][^>]*>/gi;
  for (const match of (pull.body || '').slice(0, 65536).matchAll(pattern)) {
    try {
      const original = match[2] || match[3];
      if (!original) continue;
      if (decodeURIComponent(original).split('/').some(p => p === '.' || p === '..')) continue;
      const url = new URL(original);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) continue;
      const prefix = url.hostname === 'github.com' ? `/${repository}/blob/` : url.hostname === 'raw.githubusercontent.com' ? `/${repository}/` : null;
      if (!prefix || !url.pathname.startsWith(prefix)) continue;
      const relative = decodeURIComponent(url.pathname.slice(prefix.length));
      const parts = /^([a-f0-9]{40})\/(.+\.(?:png|jpe?g|webp|gif))$/i.exec(relative);
      const commit = parts?.[1], path = parts?.[2];
      if (!commit || !path || path.split('/').some(p => !p || p === '.' || p === '..') || /[\s%\\\u0000-\u001f]/.test(path)) continue;
      const src = `https://raw.githubusercontent.com/${repository}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
      if (seen.has(src)) continue;
      seen.add(src);
      const alt = (match[1] || /\balt\s*=\s*["']([^"']*)["']/i.exec(match[0])?.[1] || '').slice(0, 160);
      images.push({ src, alt, commit });
      if (images.length === 2) break;
    } catch { /* Malformed/untrusted images never reach the browser. */ }
  }
  return images;
}
