/** No credential collection or client-derived eligibility while the pilot is unavailable. */
export function ParticipationNotice() {
  return <section className="panel" aria-label="Civic participation status">
    <h2>Verified eligible participants — advisory</h2>
    <p><strong>Not available.</strong> Civic eligibility verification is not enabled. No verified participant count is reported.</p>
    <p>You can participate anonymously with an unverified browser vote. A browser cookie is not proof of a unique person, age or residency. GitHub repository membership is separate from civic eligibility.</p>
    <p>All participation is advisory and non-binding. This service does not run legally binding elections or represent governmental authority.</p>
    <a href="/account">Participation &amp; privacy</a>
  </section>;
}
