import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTRIBUTION_ROLES, type CitizenProposalView, type ProposalCreditInput, type ContributionRole } from "../shared/citizen-proposals";

export function ProposalCredits({ proposal, submit }: { proposal: CitizenProposalView; submit: (body: ProposalCreditInput) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const credits = proposal.credits;
  if (!credits) return null;
  async function send(event: FormEvent<HTMLFormElement>, remove = false) {
    event.preventDefault();
    if (busy || !credits) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (!remove && data.get("consent") !== "on") return;
    setBusy(true); setError(""); setStatus("");
    try {
      const base = { revision: credits.revision, expectedVersion: credits.version };
      await submit(remove ? { ...base, action: "remove" } : { ...base, action: "opt-in", confirmedPublic: true,
        role: data.get("role") as ContributionRole, preference: data.get("preference") as "pseudonym" | "unnamed", alias: String(data.get("alias") ?? "") });
      form.reset(); setStatus(remove ? "Credit removed. Name-free history retained." : "Your public credit is saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Credit could not be saved. Retry."); }
    finally { setBusy(false); }
  }
  return <section className="cp-panel cp-discussion cp-credits" aria-labelledby="credits-title">
    <h2 id="credits-title">Contributors & credits</h2>
    <p>Credits apply to this exact published citizen proposal. Roles are self-reported, not verified authorship, votes or simulated participants. Supporting citations above remain unverified.</p>
    <p>Opt in only for yourself. Use an invented pseudonym or unnamed credit; do not enter real identities or private journal content. No journal or account identity is copied into credits.</p>
    <ul>{credits.contributors.map((c, i) => <li key={i}>{c.alias} · {c.role}</li>)}</ul>
    {!credits.contributors.length && <p>No opted-in credits yet.</p>}
    <form onSubmit={e => send(e)}><fieldset disabled={busy}><legend>{credits.ownActive ? "Update my credit" : "Add my contribution"}</legend>
      <label className="cp-field">Role for this version<select name="role">{CONTRIBUTION_ROLES.map(role => <option key={role}>{role}</option>)}</select></label>
      <label className="cp-field">Attribution preference<select name="preference"><option value="unnamed">Unnamed contributor</option><option value="pseudonym">My invented pseudonym</option></select></label>
      <label className="cp-field">Pseudonym (only used when selected)<input name="alias" maxLength={80} autoComplete="off" /></label>
      <label className="cp-checkbox"><input type="checkbox" name="consent" required />I contributed and opt in to public credit for this version with my chosen preference.</label>
      <button className="cp-button" type="submit">Save my credit</button>
    </fieldset></form>
    {credits.ownActive && <form onSubmit={e => send(e, true)}><button disabled={busy} className="cp-button cp-button-secondary" type="submit">Request removal of my credit now</button></form>}
    <p>Removal immediately hides your current credit and deletes its stored pseudonym here. Previous downloads, screenshots and backups cannot be recalled. Browser-cookie access is required; losing it loses these controls. This is not authenticated identity verification.</p>
    <details><summary>Name-free credit history ({credits.version})</summary><ol>{credits.history.map(e => <li key={e.version}>{e.action} · {e.role} · {e.preference} · <time dateTime={e.createdAt}>{e.createdAt}</time></li>)}</ol></details>
    {error && <p ref={errorRef} role="alert" tabIndex={-1}>{error}</p>}<p role="status">{busy ? "Saving credits…" : status}</p>
  </section>;
}
