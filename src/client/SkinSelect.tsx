import { useEffect, useId, useState } from 'react';
import { applySkin, SKINS, validSkin } from './skins';

export function SkinSelect() {
  const id = useId();
  const [skin, setSkin] = useState(() => validSkin(typeof document === 'undefined' ? null : document.documentElement.dataset.skin));
  useEffect(() => {
    const changed = () => setSkin(validSkin(document.documentElement.dataset.skin));
    const stored = (event: StorageEvent) => {
      if (event.key !== 'civic-skin' && event.key !== null) return;
      document.documentElement.dataset.skin = validSkin(event.newValue);
      changed();
    };
    window.addEventListener('civic-skin-change', changed);
    window.addEventListener('storage', stored);
    return () => { window.removeEventListener('civic-skin-change', changed); window.removeEventListener('storage', stored); };
  }, []);
  return <label className="skin-select" htmlFor={id}>Visual skin<select id={id} value={skin} onChange={event => applySkin(window, event.target.value)}>{SKINS.map(value => <option key={value} value={value}>{value[0]!.toUpperCase() + value.slice(1)}</option>)}</select></label>;
}
