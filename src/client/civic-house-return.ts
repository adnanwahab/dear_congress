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
    if (!ready) return;
    let enteredFromHouse = false;
    try {
      enteredFromHouse = sessionStorage.getItem('civic-house-pending-stage') === route;
      if (enteredFromHouse) sessionStorage.removeItem('civic-house-pending-stage');
    } catch { /* Storage is optional; the ordinary route still works. */ }
    if (!enteredFromHouse && !document.referrer.includes('/?house=1')) return;
    const id = savedRoom(route).focus;
    (document.getElementById(id) ?? document.getElementById('stage-heading'))?.focus();
  }, [route, ready]);
}

/** Mount return handling only inside civic stage workflows. */
export function RoomReturn({ route, ready }: { route: string; ready: boolean }) {
  useRoomReturn(route, ready);
  return null;
}
