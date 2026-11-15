import { useEffect } from 'react';
const key = (route: string) => `civic-house-return:${route}`;
export function savedRoom(route: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key(route)) ?? 'null');
    const url = new URL(saved?.url, window.location.origin);
    if (url.origin === window.location.origin && url.pathname === route && !url.searchParams.has('live')) return { url: url.pathname + url.search + url.hash, focus: typeof saved.focus === 'string' ? saved.focus : '' };
  } catch {}
  return { url: route, focus: '' };
}
/** Save only this stage's URL and element ID; never copy votes, draft text or records. */
export function useRoomReturn(route: string, ready: boolean) {
  useEffect(() => {
    const save = () => { try { sessionStorage.setItem(key(route), JSON.stringify({ url: window.location.pathname + window.location.search + window.location.hash, focus: document.activeElement?.id || 'stage-heading' })); } catch {} };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [route]);
  useEffect(() => {
    if (!ready || !document.referrer.includes('/?house=1')) return;
    const id = savedRoom(route).focus;
    (id ? document.getElementById(id) : null)?.focus();
  }, [route, ready]);
}
