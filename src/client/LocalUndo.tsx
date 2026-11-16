import { useEffect, useRef, useState } from 'react';

export const LOCAL_UNDO_MS = 20_000;
/** Page-local callbacks only: never register a publication, vote or server mutation. */
export function useLocalUndo() {
  const latest = useRef<{ restore: () => boolean | void; label: string; expires: number } | null>(null);
  const [version, render] = useState(0);
  const [message, setMessage] = useState('');
  const paused = useRef(false);
  function record(label: string, restore: () => boolean | void) {
    latest.current = { label, restore, expires: Date.now() + LOCAL_UNDO_MS };
    setMessage(`${label}. Undo available for 20 seconds; a new action replaces it.`);
    render(n => n + 1);
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (latest.current && !paused.current && Date.now() >= latest.current.expires) {
        latest.current = null;
        setMessage('Local Undo expired. Your current settings are unchanged.');
        render(n => n + 1);
      }
    }, 250);
    return () => clearInterval(timer);
  }, []);
  function undo() {
    const entry = latest.current;
    if (!entry) return;
    if (!paused.current && Date.now() >= entry.expires) {
      latest.current = null; setMessage('Local Undo expired.'); render(n => n + 1); return;
    }
    if (entry.restore() === false) { setMessage('Could not restore the local change. Try Undo again.'); return; }
    latest.current = null;
    setMessage(`Restored ${entry.label}. Only local sandbox settings changed.`);
    render(n => n + 1);
  }
  // Keep the button mounted after use/expiry so keyboard focus is not discarded.
  const control = <div className="local-undo" data-version={version}
    onPointerEnter={() => { paused.current = true; }}
    onPointerLeave={e => { if (!e.currentTarget.contains(document.activeElement)) { paused.current = false; if (latest.current) latest.current.expires = Date.now() + LOCAL_UNDO_MS; } }}
    onFocus={() => { paused.current = true; }}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) { paused.current = false; if (latest.current) latest.current.expires = Date.now() + LOCAL_UNDO_MS; } }}>
    <p aria-live="polite" aria-atomic="true">{message}</p>
    {message && <button type="button" className="outline" aria-disabled={!latest.current} onClick={undo} style={{ minHeight: 44 }}>Undo local change</button>}
  </div>;
  return { record, control };
}
