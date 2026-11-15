/** Original, quiet PCM miniatures. Generated locally: no download or audio context. */
export type CivicCue = 'navigation' | 'sandbox' | 'completion';
export const SOUND_KEY = 'civic-sound';
let enabled = false;
let active: HTMLAudioElement | undefined;
let last = 0;
const sources = new Map<CivicCue, string>();
export function stopSound() { active?.pause(); if (active) active.currentTime = 0; active = undefined; }
export function setSoundEnabled(value: boolean) { enabled = value; if (!value) stopSound(); }
export function soundSource(cue: CivicCue): string {
  const cached = sources.get(cue); if (cached) return cached;
  const rate = 16000, duration = cue === 'completion' ? .18 : .09;
  const count = Math.floor(rate * duration), bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => [...value].forEach((c, i) => bytes[at + i] = c.charCodeAt(0));
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, count * 2, true);
  const frequency = cue === 'navigation' ? 440 : cue === 'sandbox' ? 330 : 550;
  for (let i = 0; i < count; i++) {
    const t = i / rate, envelope = Math.sin(Math.PI * i / count) ** 2;
    view.setInt16(44 + i * 2, Math.round(1800 * envelope * Math.sin(2 * Math.PI * frequency * t)), true);
  }
  const source = 'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes)); sources.set(cue, source); return source;
}
/** Call only within an explicit user activation, never mount/network/timer effects. */
export function playSound(cue: CivicCue): boolean {
  if (!enabled || typeof window === 'undefined' || document.visibilityState === 'hidden' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off' ||
      new URLSearchParams(window.location.search).has('demo')) return false;
  const now = Date.now(); if (now - last < 150) return false;
  last = now; stopSound();
  try {
    const audio = new Audio(soundSource(cue)); active = audio; audio.volume = .35;
    void audio.play().catch(() => { if (active === audio) stopSound(); }); return true;
  } catch { stopSound(); return false; }
}
