import overviewDemo from './assets/media-kit/overview-demo.png';
import votesDemo from './assets/media-kit/votes-demo.png';

const repository = 'https://github.com/adnanwahab/dear_congress';

/** Static editorial resources; no participation or tracking side effects. */
export default function MediaKit() {
  return <section id="media-kit" className="media-kit" aria-labelledby="media-kit-title">
    <p className="map-eyebrow">For journalists &amp; civic organizers · review before sharing</p>
    <h2 id="media-kit-title">Civic Synthesis media kit</h2>
    <p>Civic Synthesis is an independently operated, non-binding public beta for exploring policy proposals, expressing advisory preferences and turning everyday needs into illustrative civic plans.</p>
    <p><strong>Not a government service.</strong> It does not cast official ballots, enact laws, authorize spending or represent an agency. Sample proposals, fictional counts and model simulations are not verified public opinion or evidence of policy impact.</p>
    <h3>Check the source and reproduce a sample</h3>
    <ul>
      <li><a href={repository}>Source repository: adnanwahab/dear_congress</a> · <a href={`${repository}#run`}>Run locally and run checks</a></li>
      <li><a href={`${repository}/blob/main/docs/audit-reproducibility.md`}>Offline sample replay and its limits</a>: reproduces fabricated tally arithmetic, not real participation or a full policy package.</li>
      <li><a href="/version">Running build identity</a> · <a href="#sources-and-methodology">Sources and methodology</a> · <a href="/account">Participation &amp; privacy</a></li>
    </ul>
    <h3>Demo screenshots</h3>
    <p>Captured November 16, 2026 at 1440 × 1000 from the review workspace. These are dated interface examples, not a claim about the currently deployed build. Keep the demo caption and visible limitations with any excerpt. Open an image for full resolution.</p>
    <div className="media-kit-images">
      <figure><a href={overviewDemo}><img src={overviewDemo} alt="Demo overview with advisory participation notice and a sample housing scenario" width="1440" height="1000" loading="lazy" /></a><figcaption><strong>Demo — overview.</strong> Sample housing scenario; no official ballot or verified participation count. <a href="/">Explore the overview</a>.</figcaption></figure>
      <figure><a href={votesDemo}><img src={votesDemo} alt="Demo Votes page showing fictional learning activities and a city council rehearsal" width="1440" height="1000" loading="lazy" /></a><figcaption><strong>Demo — Votes page.</strong> Fictional learning activities, not an election or real council proceeding. <a href="/votes">Explore Votes</a>.</figcaption></figure>
    </div>
    <h3>Names, logos and permission</h3>
    <p>Identify the project by its plain-text name, Civic Synthesis, with a source link. No downloadable logo with verified reuse permission is published in this kit. Ask the maintainer before using a logo; government seals, agency marks and third-party logos are not supplied or cleared for reuse. Do not imply government affiliation or endorsement.</p>
    <h3>Contact and editorial review</h3>
    <p><a href={`${repository}/issues/new`}>Contact the maintainer through a public GitHub issue</a> (GitHub account required). This is a public channel; omit private journal text, contact details and cookie identifiers. No private press contact or response time is promised.</p>
    <p>Before amplifying, ask a reader to explain what is demo data, what an advisory vote does and who operates the beta. Report confusion and usefulness through the feedback channel. Sharing volume does not establish meaningful participation. No stance-based rewards or automatic outreach are part of this kit.</p>
  </section>;
}
