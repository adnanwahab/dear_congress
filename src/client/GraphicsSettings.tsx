import { useState } from 'react';
import { graphicsMode, setGraphicsMode, type GraphicsMode } from './graphics';
export function GraphicsSettings() {
  const [mode, setMode] = useState<GraphicsMode>(() => typeof window === 'undefined' ? 'auto' : graphicsMode(window));
  return <section className="panel" id="graphics"><h2>Graphics quality</h2>
    <label htmlFor="graphics-quality">Optional map rendering </label>
    <select id="graphics-quality" value={mode} style={{ minHeight: 44 }} onChange={event => { const value = event.target.value as GraphicsMode; setMode(value); setGraphicsMode(window, value); }}>
      <option value="auto">Auto — measured performance</option><option value="lite">Lite — lower power</option><option value="standard">Standard</option><option value="cinematic">Cinematic</option>
    </select>
    <p>Auto adjusts map resolution from active frame timings. Choose Lite to reduce graphics work on low-power devices. Motion accessibility remains controlled by your system preference. Every tier keeps the same facts and controls; drafts and votes are unchanged.</p>
    <p>If graphics are unavailable, use the text needs and jurisdiction summaries. This browser saves only the graphics choice; blocked storage keeps it for this page.</p>
  </section>;
}
