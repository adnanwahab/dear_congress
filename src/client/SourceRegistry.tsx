import { DEMO_ITEMS } from '../engine/demo';
import { HUNT_SOURCES } from './SourceTreasureHunt';
import { safeProvenanceLink } from '../shared/provenance';

/** Citation inventory only. Null dates never become render time or approval. */
export interface RegistrySource {
  id: string; title: string; publisher: string; url: string | null;
  scope: string; kind: string; retrieved: string | null; lastReview: string | null;
  license: string;
}
const pendingLicense = 'Reuse terms not reviewed. Public access does not establish permission to redistribute.';
const external = (id: string, title: string, publisher: string, url: string, scope: string, kind = 'Source-backed metadata · under review'): RegistrySource => ({ id, title, publisher, url, scope, kind, retrieved: null, lastReview: null, license: pendingLicense });
export const REGISTRY_SOURCES: readonly RegistrySource[] = [
  ...DEMO_ITEMS.map(item => ({ ...external(`sample-background:${item.id}`, item.background?.name ?? item.source, item.background?.publisher ?? 'Unknown', item.sourceUrl, `${item.background?.scope ?? 'Scope unknown'}. Background only; does not substantiate fictional proposal text, tallies or modeled effects.`, 'Editorial background · fictional sample'), lastReview: item.background?.checkedAt ?? null })),
  ...HUNT_SOURCES.map(source => external(`learning:${source.id}`, source.title, source.publisher, source.url, `${source.place}; ${source.date}. Learning reference, not evidence of participation.`, 'Historical / learning citation · under review')),
  external('outcomes:flooding', 'OpenFEMA NFIP redacted claims v2', 'Federal Emergency Management Agency', 'https://www.fema.gov/openfema-data-page/fima-nfip-redacted-claims-v2', 'Harris County; annual insurance claims, three-year average. Claims omit uninsured losses. Fetch adapter is not proof that starter values were retrieved.'),
  external('outcomes:transit', 'ACS B08303', 'U.S. Census Bureau', 'https://api.census.gov/data/2023/acs/acs1/groups/B08303.html', 'Travel-time schema; outcomes adapter uses ACS one-year estimates for Harris County from 2015 onward. Survey error and release differences apply. Schema citation is not a numeric observation.'),
  external('outcomes:streets', 'Houston 311 service request feeds', 'City of Houston', 'https://mycity.houstontx.gov/arcgis/rest/services/wm/', 'Recent and archived service-request adapters; median closure days for street-like cases. Operational closure is not verified physical repair.'),
  external('study:oregon', 'The Oregon Experiment — Effects of Medicaid on Clinical Outcomes', 'Baicker et al.; New England Journal of Medicine, hosted by PubMed Central', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3701298/', '2013 study; Oregon lottery population, approximately two-year follow-up. Mixed endpoints; editorial interpretation is not a second independent study.', 'Historical study citation · under review'),
  external('constitution:article-i', 'Constitution, Article I', 'U.S. Senate', 'https://www.senate.gov/civics/constitution_item/constitution.htm', 'Senate composition text citation. Selection provisions were amended by the Seventeenth Amendment. Not current membership or legal advice.', 'Historical text citation · under review'),
  external('import:census-2020', '2020 Census apportionment release', 'U.S. Census Bureau', 'https://www.census.gov/library/stories/2021/04/2020-census-data-release.html', 'Dataset-import transcription specimen; 2020 US resident population. Not fetched by the workbench or independently verified.', 'Historical transcription · under review'),
  external('legislation:adapter', 'Congress.gov bill metadata adapter', 'Library of Congress / Congress.gov', 'https://api.congress.gov/', 'Provider-level entry only. Imported bill records retain their exact congress/type/number URL, source hash and checkedAt. No provider entry certifies individual bills.'),
  { id: 'internal:fixtures', title: 'Internal synthetic fixtures and modeled futures', publisher: 'adnanwahab/dear_congress contributors', url: null, scope: 'src/engine/catalog.ts, src/engine/demo.ts, src/shared/policy-measurements.ts and related outcome demonstrations. Invented residents, responses, costs and future scenarios are not observations, official claims or forecasts. data/outcomes.json is a starter fixture; recorded fetchedAt alone does not verify upstream retrieval.', kind: 'Internal synthetic fixture · illustrative', retrieved: null, lastReview: null, license: 'Internal authorship does not establish a public reuse license. Repository licensing requires review.' },
];

export default function SourceRegistry() {
  return <section aria-labelledby="source-registry">
    <h3 id="source-registry">Inspectable source registry</h3>
    <p>Read-only citation inventory for sample backgrounds, learning references and core evidence adapters. Coverage is incomplete: user-supplied citations, individual imported bills, map assets and other editorial links require separate inventory and review. No source here has verified public reuse approval.</p>
    <p>Retrieval means obtaining the original source; last review means a recorded source check, not authenticated human approval. Unknown dates stay unknown. A historical document, measurement, editorial interpretation and modeled future have different meanings. These entries grant no voting or merge authority.</p>
    {REGISTRY_SOURCES.map(source => {
      const url = safeProvenanceLink(source.url);
      return <details key={source.id}><summary>{source.title} — {source.kind}</summary><dl style={{ overflowWrap: 'anywhere' }}>
        <dt>Registry identity</dt><dd>{source.id}</dd>
        <dt>Publisher</dt><dd>{source.publisher}</dd>
        <dt>Original URL</dt><dd>{url ? <a href={url}>{url}</a> : 'Not applicable — internally authored fixture'}</dd>
        <dt>Retrieval date</dt><dd>{source.retrieved ?? 'Unknown / not recorded'}</dd>
        <dt>Licensing note</dt><dd>{source.license}</dd>
        <dt>Scope and uncertainty</dt><dd>{source.scope}</dd>
        <dt>Last review</dt><dd>{source.lastReview ?? 'Unknown / pending source and license review'}</dd>
      </dl></details>;
    })}
    <details><summary>Copy / print registry JSON</summary><p>Select and copy this text or use browser Print. It includes unknown dates and review limitations; it contains no journals, ballots or credentials.</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ schema: 'source-registry-v1', coverage: 'Partial curated inventory; not approval or comprehensive source coverage', sources: REGISTRY_SOURCES }, null, 2)}</pre></details>
  </section>;
}
