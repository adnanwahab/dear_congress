export const SKINS = ['standard', 'paper', 'orbital', 'terminal'] as const;
export type Skin = typeof SKINS[number];
export function validSkin(value: unknown): Skin {
  return SKINS.includes(value as Skin) ? value as Skin : 'standard';
}
/** Only appearance storage is touched. Query override is tab-local for recovery. */
export function installSkin(target: Window) {
  const query = new URL(target.location.href).searchParams;
  let saved: string | null = null;
  try { saved = target.localStorage.getItem('civic-skin'); } catch { /* Optional storage. */ }
  target.document.documentElement.dataset.skin = validSkin(query.has('skin') ? query.get('skin') : saved);
}
export function applySkin(target: Window, value: unknown) {
  const skin = validSkin(value);
  target.document.documentElement.dataset.skin = skin;
  try { target.localStorage.setItem('civic-skin', skin); } catch { /* Current document still works. */ }
  const event = target.document.createEvent('Event');
  event.initEvent('civic-skin-change', false, false);
  target.dispatchEvent(event);
}
