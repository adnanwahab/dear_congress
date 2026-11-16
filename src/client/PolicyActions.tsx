import type { DemoItem } from '../engine/demo';

// Editorial directory links, never inferred from a proposal's untrusted source URL.
const channels = {
  City: { publisher: 'City of Houston', url: 'https://www.houstontx.gov/council/' },
  County: { publisher: 'Harris County', url: 'https://www.harriscountytx.gov/' },
  State: { publisher: 'Texas Legislature Online', url: 'https://capitol.texas.gov/' },
  Federal: { publisher: 'Library of Congress · Congress.gov', url: 'https://www.congress.gov/' },
} as const;

export function PolicyActions({ item }: { item: Pick<DemoItem, 'id' | 'title' | 'jurisdiction'> }) {
  const channel = Object.hasOwn(channels, item.jurisdiction) ? channels[item.jurisdiction as keyof typeof channels] : undefined;
  return <section className="panel policy-actions" aria-label={`Real-world next steps for ${item.title}`} data-proposal-id={item.id}>
    <h2>Optional real-world next steps</h2>
    <p>For: {item.title} · {item.jurisdiction}. Explore, ask questions, or choose no action. These directories do not establish that this proposal is introduced, on an agenda, or supported by an office.</p>
    <p>Demo votes and sponsor progress are not verified civic participation. Opening a link does not record contact, attendance, or completion.</p>
    {channel ? <>
      <p>Official directory: {channel.publisher}. Directory selected by scenario jurisdiction, not your location or eligibility. Confirm the responsible agency and district; transit services may require METRO rather than City Council.</p>
      <ul>
        {[
          ['Read an agenda', 'Use the official agenda, calendar or committee links to look for the topic. A matching hearing may not exist.'],
          ['Explore attending a hearing', 'Check the official meeting notice for dates, location, accessibility, entry and public-comment rules before making plans.'],
          ['Find an office to contact', 'Use the official member or office directory to confirm jurisdiction and contact details. You may ask a neutral question or share your own view.'],
        ].map(([label, description]) => <li key={label}><h3>{label}</h3><p>{description}</p><a href={channel.url} target="_blank" rel="noopener noreferrer">{label} via {channel.publisher} — External site, opens in new tab ↗</a></li>)}
      </ul>
      <p>Directory reference only; meeting availability and contact details are not checked live. If a site is unavailable, try again later or navigate from the publisher’s official homepage. No action is required.</p>
    </> : <p>Official action channels unavailable for this jurisdiction. Confirm the responsible public authority through its official website before planning outreach.</p>}
  </section>;
}
