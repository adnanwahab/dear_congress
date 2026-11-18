import { ATLAS_REGIONS, ATLAS_SOURCE, atlasFreshness, atlasSelection } from '../shared/policy-atlas';

export function PolicyAtlas({ params, change }: { params: URLSearchParams; change: (key: string, value: string) => void }) {
  const { region, invalid } = atlasSelection(params);
  const atlas = params.get('view') === 'atlas';
  return <section className="bill-notice policy-atlas" aria-labelledby="atlas-title">
    <h2 id="atlas-title">National policy atlas</h2>
    <p>Explore proposed decision scopes. Colors identify navigation only, never verified regional voter support. Draft concepts are hypothetical; no regional policy evidence or endorsements are registered. International proposals are ideas for multilateral cooperation, not laws of a world government or U.S. regional policies.</p>
    <button aria-pressed={atlas} onClick={() => change('view', atlas ? '' : 'atlas')}>{atlas ? 'Use text-only regions / low power' : 'Show geographic overview'}</button>
    {atlas && <div className="atlas-overview" role="group" aria-label="Schematic Census region overview"><p>Geographic schematic · not to scale. Alaska and Hawaii included in West. Territories are outside these Census regions; use All regions to browse their unassigned concepts.</p>{ATLAS_REGIONS.map(r => <button key={r.id} className={`atlas-${r.id}`} aria-pressed={region?.id === r.id} onClick={() => change('region', r.id)}>{r.name}</button>)}</div>}
    <label>Browse region<select value={region?.id ?? ''} onChange={e => change('region', e.target.value)}><option value="">All regions / unassigned</option>{ATLAS_REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    <label>Proposed decision scope<select value={params.get('scope') ?? ''} onChange={e => change('scope', e.target.value)}><option value="">All scopes</option>{['federal', 'state', 'county', 'city', 'international'].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
    {invalid && <p role="alert">Unknown region. No geographic binding can be established. Choose a listed region or All regions.</p>}
    {region && <><h3>{region.name}</h3><p>{region.states}.</p><p>No reviewed region-specific proposal bindings. Results below include only federal concepts with hypothetical national scope, not evidence of local applicability. State, county, city and international concepts remain unassigned; choose All regions to browse them.</p></>}
    <p><a href={ATLAS_SOURCE}>U.S. Census Bureau · region membership source</a> · {atlasFreshness()}. Statistical geography only; not evidence for a proposal. <a href="/topics">Browse existing topic hubs</a>.</p>
  </section>;
}
