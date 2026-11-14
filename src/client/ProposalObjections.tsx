import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CitizenProposalView } from "../shared/citizen-proposals";

export function ProposalObjections({ proposal, submit }: {
  proposal: CitizenProposalView;
  submit: (body: unknown) => Promise<void>;
}) {
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function send(event: FormEvent<HTMLFormElement>, respond?: { id: string; version: number }) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true); setError(""); setStatus("");
    try {
      await submit(respond ? { action: "respond", objectionId: respond.id, expectedVersion: respond.version, ...data }
        : { action: "create", ...data, confirmedPublic: data.confirmedPublic === "on", idempotencyKey: key });
      form.reset();
      if (!respond) setKey(crypto.randomUUID());
      setStatus(respond ? "Proposer response saved." : "Public objection saved as unresolved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save. Retry your submission."); }
    finally { setBusy(false); }
  }
  return <section className="cp-panel cp-discussion" aria-labelledby="objections-title">
    <h2 id="objections-title">Structured objections</h2>
    <p>These objections concern the immutable published text above. Constituencies are self-described, not verified representation or evidence of community agreement. Do not include personal information.</p>
    <p>Advisory only. Acceptance, revised text and re-voting are not available yet. Existing browser responses have no fixed voting window or consent threshold.</p>
    <ol className="cp-comments">{(proposal.objections ?? []).map(o => <li key={o.id}>
      <h3>{o.severity} · {o.responses.at(-1)?.status ?? "unresolved"}</h3>
      <p>{o.text}</p><p>Impacted constituency (self-described): {o.constituency}</p>
      <p>Recorded <time dateTime={o.createdAt}>{o.createdAt}</time></p>
      <ol>{o.responses.map((r, i) => <li key={i}><p>Proposer · {r.status} · <time dateTime={r.createdAt}>{r.createdAt}</time></p><p>{r.reason}</p></li>)}</ol>
      {proposal.canRespondToObjections && <form onSubmit={e => send(e, { id: o.id, version: o.responses.length })}>
        <fieldset disabled={busy}><legend>Proposer response</legend>
          <label className="cp-field">Decision<select name="status"><option value="unresolved">Unresolved / reopen</option><option value="declined">Decline with reason</option></select></label>
          <label className="cp-field">Reason<textarea name="reason" required maxLength={2000} /></label>
          <button className="cp-button" type="submit">Save proposer response</button>
        </fieldset>
      </form>}
    </li>)}</ol>
    {!proposal.objections?.length && <p>No objections recorded.</p>}
    <form onSubmit={e => send(e)}><fieldset disabled={busy}><legend>Publish an objection</legend>
      <label className="cp-field">Objection<textarea name="text" required maxLength={2000} /></label>
      <label className="cp-field">Severity<select name="severity"><option value="concern">Concern</option><option value="major">Major</option><option value="blocking">Blocking</option></select></label>
      <label className="cp-field">Impacted constituency (self-described)<input name="constituency" required maxLength={160} /></label>
      <label className="cp-checkbox"><input type="checkbox" name="confirmedPublic" required />I consent to publish this objection and constituency description publicly.</label>
      <button className="cp-button" type="submit">Publish objection</button>
    </fieldset></form>
    {error && <p ref={errorRef} role="alert" tabIndex={-1}>{error}</p>}<p role="status">{busy ? "Saving…" : status}</p>
  </section>;
}
