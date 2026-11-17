import { useState } from 'react';
import { setDirection } from './motion';
import { ParticipationNotice } from './ParticipationNotice';
import './workflow.css';
export default function AccountScreen() {
  const [direction, updateDirection] = useState(() => typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr');
  return <div className="civic-shell workflow-shell"><main id="main-content" tabIndex={-1} className="civic-main workflow-main">
    <h1>Participation &amp; privacy</h1>
    <ParticipationNotice />
    <section className="panel" aria-labelledby="layout-title"><h2 id="layout-title">Layout preview</h2>
      <p id="layout-help">Direction changes layout only. English copy is unchanged; no translation is approved. Your choices and drafts stay unchanged. Restore left-to-right here if a layout is difficult to use.</p>
      <label>Reading direction <select aria-describedby="layout-help" value={direction} onChange={e => { const next = e.target.value === 'rtl' ? 'rtl' : 'ltr'; setDirection(window, next); updateDirection(next); }}><option value="ltr">Left-to-right</option><option value="rtl">Right-to-left (preview)</option></select></label>
    </section>
    <section className="panel"><h2>Unverified browser votes — advisory</h2>
      <p>No identity verification is required to take part. Your signed browser cookie saves your choice so you can change it. Clearing cookies can create another browser identity; these counts do not measure unique people.</p>
      <p>Anonymous does not mean secret from the service: current advisory choices are stored with a browser identifier. Do not submit identity documents or eligibility credentials. This page collects none.</p>
      <a className="dashboard-button" href="/votes">Continue anonymously</a>
    </section>
    <section className="panel"><h2>Synthetic demo data — illustrative</h2>
      <p>Fictional sample response totals are shown separately from saved browser choices. Neither group contributes to verified counts, and they are not combined into a people total.</p>
    </section>
    <section className="panel"><h2>Before optional verification can open</h2>
      <p>A future opt-in pilot needs a reviewed privacy protocol, eligibility scope, expiry, revocation and retention rules, plus external security and privacy review before consequential use. No provider is connected and no private ballot guarantee is made.</p>
      <a href="/privacy">Privacy &amp; removal options</a>
    </section>
  </main></div>;
}
