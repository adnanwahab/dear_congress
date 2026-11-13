import { CIVIC_STAGES } from '../shared/civic-stages';
import { useEffect, useState } from 'react';
const DESTINATIONS = [
  ...CIVIC_STAGES.map(s => ({ href: s.route, label: s.title, icon: s.n === 3 ? 'vote' : s.n === 4 ? 'draft' : 'overview' })),
  { href: '/map', label: 'Map', icon: 'map' },
  { href: '/journal', label: 'Journal', icon: 'journal' },
];
function Icon({ name }: { name: string }) {
  const paths: Record<string,string> = {
    overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z M9 3v16 M15 5v16',
    needs: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M2 21v-3a5 5 0 0 1 10 0v3 M12 16a5 5 0 0 1 10 2v3',
    vote: 'm8 10 3 3 5-6 M5 3h14v14H5z M3 17v4h18v-4',
    draft: 'M6 3h9l4 4v14H6V3Z M14 3v5h5 M9 12h7 M9 16h7',
    journal: 'M4 3h16v18H4z M8 3v18 M11 8h6 M11 12h6 M11 16h4',
  };
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
export function BottomNavigation() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => { const update = () => setPath(window.location.pathname); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  const current = path.replace(/\/+$/, '') || '/';
  return <div className="bottom-bar"><nav className="bottom-destinations" aria-label="Main navigation">{DESTINATIONS.map(d => <a href={`${d.href}${CIVIC_STAGES.some(s => s.route === d.href) && new URLSearchParams(window.location.search).get('proposal') ? `?proposal=${encodeURIComponent(new URLSearchParams(window.location.search).get('proposal')!)}` : ''}`} key={d.href} aria-current={(current === d.href || (d.href === '/votes' && (current === '/vote' || current.startsWith('/vote/happybearlandia'))) || (d.href === '/journal' && current === '/api-docs')) ? 'page' : undefined}><Icon name={d.icon} /><span>{d.label}</span></a>)}</nav><nav className="bottom-utilities" aria-label="Page actions"><button onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.assign('/'); }}>← Back</button><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ Top</button><a href="/">Overview</a><a href="/account" aria-current={current === "/account" ? "page" : undefined}>Participation &amp; privacy</a><a href="/needs">Needs</a><a href="/synth">Synthesis</a><a href="/documentation" aria-current={current === "/documentation" || current === "/docs" ? "page" : undefined}>Documentation</a><a href="/journal?tab=api">API docs ↗</a><span className="bottom-app-links"><a href="https://happybearlandia.fly.dev/world" target="_blank" rel="noopener noreferrer" aria-label="HBL — HappyBearLandia (opens in a new tab)">HBL ↗</a><a href="https://digital-pensieve.fly.dev/" target="_blank" rel="noopener noreferrer" aria-label="Digital Pensieve (opens in a new tab)">digital-pensieve ↗</a></span></nav></div>;
}
