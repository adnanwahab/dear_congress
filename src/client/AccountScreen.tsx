import { ParticipationNotice } from './ParticipationNotice';
import './workflow.css';
export default function AccountScreen() {
  return <div className="civic-shell workflow-shell"><main id="main-content" tabIndex={-1} className="civic-main workflow-main">
    <h1>Participation &amp; privacy</h1>
    <ParticipationNotice />
    <section className="panel"><h2>Unverified browser votes — advisory</h2>
      <p>No identity verification is required to take part. Your signed browser cookie saves your choice so you can change it. Clearing cookies can create another browser identity; these counts do not measure unique people.</p>
      <p>Anonymous does not mean secret from the service: current advisory choices are stored with a browser identifier. Do not submit identity documents or eligibility credentials. This page collects none.</p>
      <a className="dashboard-button" href="/votes">Continue anonymously</a>
    </section>
    <section className="panel"><h2>Private draft recovery</h2>
      <p>The guided proposal workspace autosaves locally after editing pauses. On return, compare and choose whether to restore saved text. Conflicts pause autosave until you choose. Nothing is published.</p>
      <p>Browser storage is unencrypted and shared with this browser profile. Clearing it loses recovery and revision history. If saving fails or safe locking is unavailable, copy the complete recovery text before leaving. Other proposal editors still use their existing save controls.</p>
      <a href="/proposals/new?guided=1">Open private draft recovery</a>
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
