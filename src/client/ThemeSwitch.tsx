import { useEffect, useState } from 'react';
import { runViewTransition } from './motion';

export type ThemePreference = 'system' | 'light' | 'dark';
export const nextTheme = (current: ThemePreference): ThemePreference => current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
export function applyTheme(preference: ThemePreference) {
  const theme = preference === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141a23' : '#f7f5ef');
}

export function ThemeSwitch() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const value = document.documentElement.dataset.themePreference;
    return value === 'light' || value === 'dark' ? value : 'system';
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = () => { if (preference === 'system') applyTheme('system'); };
    const stored = (event: StorageEvent) => {
      if (event.key !== 'civic-theme' && event.key !== null) return;
      const value = event.newValue;
      const next = value === 'light' || value === 'dark' ? value : 'system';
      setPreference(next); applyTheme(next);
    };
    system.addEventListener('change', changed);
    window.addEventListener('storage', stored);
    return () => { system.removeEventListener('change', changed); window.removeEventListener('storage', stored); };
  }, [preference]);
  async function cycle(button: HTMLButtonElement) {
    if (busy) return;
    const next = nextTheme(preference);
    let committed = false;
    const update = () => {
      committed = true;
      try { localStorage.setItem('civic-theme', next); } catch { /* Optional storage. */ }
      applyTheme(next);
      setPreference(next);
    };
    // The circular reveal is CSS (theme-reveal in styles.css); hand it the switch's position.
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement.style;
    root.setProperty('--theme-x', `${x}px`); root.setProperty('--theme-y', `${y}px`); root.setProperty('--theme-r', `${radius}px`);
    setBusy(true);
    try { await runViewTransition(update, 'theme'); }
    catch { if (!committed) update(); }
    finally { setBusy(false); }
  }
  const label = preference[0]!.toUpperCase() + preference.slice(1);
  return <button type="button" className="theme-switch" disabled={busy} aria-label={`Theme: ${label}. Switch to ${nextTheme(preference)} theme`} onClick={event => void cycle(event.currentTarget)}><span aria-hidden="true">{preference === 'dark' ? '☾' : preference === 'light' ? '☀' : '◐'}</span><span>{label}</span></button>;
}
