import { useEffect, useState } from 'react';
import { playSound, setSoundEnabled, SOUND_KEY, stopSound, type CivicCue } from './civic-sound';

export function SoundControl() {
  const [on, setOn] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(media.matches); if (media.matches) stopSound(); };
    update(); setSoundEnabled(false);
    try { const saved = localStorage.getItem(SOUND_KEY) === 'on'; setOn(saved); setSoundEnabled(saved); } catch { /* Off by default. */ }
    const storage = (e: StorageEvent) => { if (e.key === SOUND_KEY || e.key === null) { const value = e.key !== null && e.newValue === 'on'; setOn(value); setSoundEnabled(value); } };
    const hide = () => { if (document.visibilityState === 'hidden') stopSound(); };
    window.addEventListener('storage', storage); document.addEventListener('visibilitychange', hide); media.addEventListener('change', update);
    return () => { window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', hide); media.removeEventListener('change', update); stopSound(); };
  }, []);
  function toggle() {
    const value = !on; setOn(value); setSoundEnabled(value);
    try { localStorage.setItem(SOUND_KEY, value ? 'on' : 'off'); } catch { /* Page-only preference. */ }
  }
  return <div className="sound-control"><button type="button" role="switch" aria-checked={on} onClick={toggle}>Sound {on ? 'On' : 'Off'}</button><details><summary>Sound tests</summary><p>Optional quiet cues, saved in this browser. Enabling sound plays nothing. Device/browser volume controls apply; some mute switches may not silence browser media. Use Sound Off for silence.</p><p>{reduced ? 'Sounds paused for reduced motion.' : 'No sound is needed to understand status.'}</p>{(['navigation', 'sandbox', 'completion'] as CivicCue[]).map(cue => <button key={cue} type="button" disabled={!on || reduced} onClick={() => playSound(cue)}>Test {cue} sound</button>)}</details></div>;
}
