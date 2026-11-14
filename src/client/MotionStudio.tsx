import { useEffect, useId, useState } from 'react';
import { MOTION_STORAGE_KEY, motionPreset, setMotionPreset, type MotionPreset } from './motion';

/** Local visual settings only; the preview never navigates or submits civic input. */
export function MotionStudio() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(() => typeof window === 'undefined' ? 'playful' : motionPreset(window));
  const [remember, setRemember] = useState(() => {
    try { return ['playful', 'calm', 'off'].includes(window.localStorage.getItem(MOTION_STORAGE_KEY) ?? ''); } catch { return false; }
  });
  const [effective, setEffective] = useState(() => typeof document === 'undefined' ? 'normal' : document.documentElement.dataset.motion);
  const [preview, setPreview] = useState(0);
  useEffect(() => {
    const changed = () => setEffective(typeof document === 'undefined' ? 'normal' : document.documentElement.dataset.motion);
    window.addEventListener('motionchange', changed);
    return () => window.removeEventListener('motionchange', changed);
  }, []);
  const choose = (next: MotionPreset, save = remember) => {
    setPreset(next); setMotionPreset(window, next, save); setPreview(n => n + 1);
  };
  return <details className="motion-studio" onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => {
    if (event.key === 'Escape') {
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus();
    }
  }}>
    <summary>Motion</summary>
    {open && <div className="motion-studio-panel">
      <h2>Motion studio</h2>
      <p id={`${id}-help`}>Choose how the app moves. Your device’s reduced-motion setting always turns motion off.</p>
      <fieldset aria-describedby={`${id}-help`}><legend>Motion preset</legend>
        {(['playful', 'calm', 'off'] as const).map(value => <label key={value}>
          <input type="radio" name={`${id}-preset`} value={value} checked={preset === value} onChange={() => choose(value)} />
          <strong>{value[0]!.toUpperCase() + value.slice(1)}</strong> · {value === 'playful' ? 'Gentle slides and expressive details' : value === 'calm' ? 'Brief route fades, still details' : 'Immediate changes'}
        </label>)}
      </fieldset>
      <label className="motion-remember"><input type="checkbox" checked={remember} onChange={event => { const save = event.currentTarget.checked; setRemember(save); choose(preset, save); }} />Remember my choice in this browser</label>
      <p role="status">{effective === 'off' && preset !== 'off' ? 'Motion is off because of your device or review setting.' : `Active: ${preset}.`}</p>
      <p>Sample route transition: Journal → Needs</p>
      <div className="motion-preview" aria-hidden="true"><div key={preview} className="motion-preview-card">Needs<br /><small>Illustrative preview · no participation data</small></div></div>
      <button type="button" onClick={() => setPreview(n => n + 1)}>Replay route preview</button>
      <p><small>Preview only. No publication or voting. Unsaved choices, or choices when storage is blocked, last for this page. Uncheck Remember to remove the saved preference.</small></p>
    </div>}
  </details>;
}
