import { useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { stageRoute } from '../shared/civic-stages';
import { JurisdictionPicker, sampleMatchesJurisdiction, useJurisdiction } from './JurisdictionPicker';
import { ProposalProvenance } from './ProposalProvenance';

export function LocalChallenges({ items, loading, failed }: { items: DemoItem[]; loading: boolean; failed: boolean }) {
  const preference = useJurisdiction();
  const [category, setCategory] = useState('');
  const scoped = items.filter(item => sampleMatchesJurisdiction(item.id, preference.value));
  const categories = [...new Set(scoped.map(item => item.topic))].sort();
  // A category selected in another locality must not hide all examples silently.
  const activeCategory = categories.includes(category) ? category : '';
  const examples = scoped.filter(item => !activeCategory || item.topic === activeCategory);
  return <section className="local-challenges panel" aria-labelledby="local-challenges-title">
    <h2 id="local-challenges-title">My area’s civic challenges</h2>
    <p>Explore public issue prompts without sharing a street address. Choose a city, county or state to begin.</p>
    <JurisdictionPicker preference={{ ...preference, change: value => { setCategory(''); preference.change(value); } }} count={loading ? null : scoped.length} />
    <p>No verified local challenge feed is connected here. These are fictional policy examples and discussion prompts, not reports of local conditions or verified civic participation.</p>
    <label className="local-category">Policy category<select value={activeCategory} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(topic => <option key={topic}>{topic}</option>)}</select></label>
    <p role="status">{loading ? 'Loading policy examples…' : `${examples.length} policy examples for ${preference.value || 'all jurisdictions'}.`}</p>
    {failed && <p role="alert">Could not refresh policy examples. Previously loaded examples may remain below. Use Try again on this page to reload.</p>}
    {!loading && !examples.length && <p>No examples match this scope. Choose another jurisdiction or <a href="/journal">describe a challenge yourself</a>. Do not include private details in a public journal entry.</p>}
    <ul className="local-challenge-grid">{examples.map(item => <li key={item.id}>
      <article><p>{item.topic} · Fictional example · {preference.value || 'Illustrative scope'}</p><h3>{item.title}</h3>
        <p>Discussion prompt: What would you change about {item.topic.toLowerCase()} in {preference.value || 'your chosen area'}, and how would you measure improvement?</p>
        <p>{item.summary}</p><ProposalProvenance item={item} compact />
        <a href={stageRoute('feed', item.id)}>Explore this sample policy</a>
      </article>
    </li>)}</ul>
  </section>;
}
