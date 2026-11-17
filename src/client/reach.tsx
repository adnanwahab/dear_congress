import { useEffect, useState } from 'react';

export type Reach = 'standard' | 'left' | 'right';
const key = 'civic-reach';
let current: Reach = 'standard';
export function readReach(): Reach {
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === 'standard' || saved === 'left' || saved === 'right') current = saved;
  } catch { /* Keep the page-memory choice when storage is blocked. */ }
  return current;
}
export function saveReach(value: Reach) {
  current = value;
  try { window.localStorage.setItem(key, value); } catch { /* Page-memory fallback. */ }
  window.dispatchEvent(new Event('civic-reach-change'));
}
export function useReach() {
  const [reach, setReach] = useState<Reach>('standard');
  useEffect(() => {
    const update = () => setReach(readReach());
    update();
    window.addEventListener('civic-reach-change', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('civic-reach-change', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return reach;
}
export function ReachPreference() {
  const reach = useReach();
  return <label className="reach-preference">Mobile exploration controls
    <select value={reach} onChange={e => saveReach(e.target.value as Reach)}>
      <option value="standard">Standard navigation</option>
      <option value="left">Lower left</option>
      <option value="right">Lower right</option>
    </select>
    <span>Only Back and Top move. Voting and content stay the same. Saved in this browser when storage is available.</span>
  </label>;
}
