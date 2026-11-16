import { useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { discoveryPool, nextDiscovery } from './surprise';

export function SurpriseExplorer({ items, loaded, failed }: { items: DemoItem[]; loaded: boolean; failed: boolean }) {
  const [history, setHistory] = useState<string[]>([]);
  const pool = discoveryPool(items);
  const current = pool.find(item => item.id === history.at(-1));
  function surprise() {
    setHistory(previous => {
      const last = pool.find(item => item.id === previous.at(-1));
      const next = nextDiscovery(pool, previous, last);
      if (!next) return previous;
      const exhausted = pool.every(item => previous.includes(item.id));
      return [...(exhausted ? [] : previous), next.id];
    });
  }
  return <section className="panel surprise-explorer" aria-labelledby="surprise-title">
    <h2 id="surprise-title">Follow your curiosity</h2>
    <p>Explore a different civic topic. Looking never casts a vote.</p>
    <button type="button" onClick={surprise} disabled={!pool.length} aria-describedby="surprise-help">Surprise me</button>
    <p id="surprise-help">Use Tab to reach the button or result link; Enter or Space activates the button. You can also tap it.</p>
    <div role="status" aria-live="polite" aria-atomic="true">
      {!loaded ? <p>{failed ? 'Explorer unavailable. Use Try again below to reload proposals.' : 'Loading topics…'}</p> : !pool.length ? <p>No topics are available yet. Try again later.</p> : current ? <article>
        <p><strong>{current.kind === 'sample' ? 'Fictional sample proposal' : 'Official background reference · not a proposal'}</strong></p>
        <p>{current.topic} · {current.jurisdiction}</p>
        <h3>{current.title}</h3><p>{current.description}</p>
        {current.kind === 'background' && <p>Linked institution background only. Current contents have not been verified; this does not substantiate the sample proposal or its effects.</p>}
        <a href={current.href}>{current.kind === 'sample' ? 'Read sample proposal' : 'Visit official background source'}</a>
        <p>{history.length} of {pool.length} results explored this round. After all results, a new round begins.</p>
      </article> : <p>Choose Surprise me to start exploring.</p>}
    </div>
    <details><summary>How selections work</summary><p>From the existing sample catalog and its official background links, we randomly choose among unseen results that change the most of: topic, source type, jurisdiction or publisher, and associated proposal. Diversity depends on available material; it is not a representative or balanced policy survey. No result repeats until the pool is exhausted. Popularity and your votes are never used.</p><p>Only this page remembers the current round. Reloading clears it. No profile, browsing history, location, or storage is used by this explorer. External links open the source site under its own privacy policy.</p></details>
  </section>;
}
