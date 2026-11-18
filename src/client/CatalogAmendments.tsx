import { useEffect, useRef, useState, type FormEvent } from "react";

export interface SavedCatalogAmendment {
  id: string;
  billId: string;
  revision: string;
  jurisdiction: string;
  text: string;
  status: "pending_review" | "withdrawn";
  createdAt: string;
  withdrawnAt: string | null;
}

interface OwnAmendments {
  billId: string;
  revision: string;
  visibility: "reviewers_only";
  amendments: SavedCatalogAmendment[];
}

type SaveResponse = {
  saved: boolean;
  replayed: boolean;
  amendment: SavedCatalogAmendment;
  receipt: { id: string; recordedAt: string };
};

async function readResponse<T>(response: Response): Promise<T> {
  let body: { error?: string };
  try { body = await response.json(); }
  catch { throw new Error("The server returned an unreadable response. Your last change may need verification."); }
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The request was not confirmed.");
  return body as T;
}

/**
 * One immutable catalog concept revision, rather than a change to law.
 * Submissions are private to the originating browser and authorized reviewers.
 */
export function CatalogAmendments({
  billId, revision, text, onTextChange,
}: {
  billId: string;
  revision: string;
  text: string;
  onTextChange: (next: string) => void;
}) {
  const [entries, setEntries] = useState<SavedCatalogAmendment[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const request = useRef<{ text: string; requestId: string } | null>(null);
  const base = "/api/catalog-bills/" + encodeURIComponent(billId) + "/amendments";

  useEffect(() => {
    const controller = new AbortController();
    setEntries([]); setLoading(true); setLoadError(""); setStatus(""); setError("");
    void fetch(base, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(response => readResponse<OwnAmendments>(response))
      .then(data => {
        if (!controller.signal.aborted) {
          if (data.billId !== billId || data.revision !== revision) throw Error("Amendment revision mismatch.");
          setEntries(data.amendments); setLoading(false);
        }
      }).catch(cause => {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : "Could not load your amendments.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [base, billId, revision]);

  async function refresh() {
    const response = await fetch(base, { credentials: "same-origin", cache: "no-store" });
    const data = await readResponse<OwnAmendments>(response);
    if (data.billId !== billId || data.revision !== revision) throw Error("Amendment revision mismatch.");
    setEntries(data.amendments);
    setLoadError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (busy || !confirmed || trimmed.length < 20 || trimmed.length > 4000) return;
    setBusy(true); setError(""); setStatus("");
    // Keep the same idempotency key if the previous response was lost.
    const requestId = request.current?.text === trimmed
      ? request.current.requestId : crypto.randomUUID();
    request.current = { text: trimmed, requestId };
    try {
      const response = await fetch(base, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision, text: trimmed, requestId, confirmForReview: true }),
      });
      const data = await readResponse<SaveResponse>(response);
      if (!data.saved || !data.receipt?.id || data.amendment?.revision !== revision)
        throw Error("The database did not confirm an amendment receipt.");
      // A successful commit is not undone by a subsequent refresh failure.
      setEntries(current => [data.amendment, ...current.filter(item => item.id !== data.amendment.id)]);
      setStatus("Saved to the amendment database. Pending human review. Receipt: " + data.receipt.id);
      setConfirmed(false); setPreview(false); onTextChange("");
      request.current = null;
      try { await refresh(); }
      catch { setLoadError("Saved, but the list did not refresh. Reload this bill to verify the submission."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The save was not confirmed. Please check before trying again.");
    } finally { setBusy(false); }
  }

  async function withdraw(id: string) {
    if (busy || withdrawing) return;
    setWithdrawing(id); setError(""); setStatus("");
    try {
      const response = await fetch(base + "/" + encodeURIComponent(id) + "/withdraw", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision, requestId: crypto.randomUUID() }),
      });
      const data = await readResponse<{ saved: boolean; receipt?: { id: string } }>(response);
      if (!data.saved || !data.receipt?.id) throw Error("Withdrawal was not confirmed.");
      setEntries(current => current.map(entry => entry.id === id
        ? { ...entry, status: "withdrawn", text: "", withdrawnAt: new Date().toISOString() } : entry));
      setStatus("Amendment withdrawn. Its text is no longer in the active review queue. Receipt: " + data.receipt.id);
      try { await refresh(); }
      catch { setLoadError("Withdrawal saved, but the list did not refresh. Reload to verify."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Withdrawal was not confirmed.");
    } finally { setWithdrawing(null); }
  }

  const trimmed = text.trim();
  return <section className="votes-amendment" aria-label="Submit a proposed amendment">
    <h3>Help improve this bill</h3>
    <p>What would you change? Suggest an amendment to this discussion concept, regardless of how you voted.</p>
    <form onSubmit={event => void submit(event)}>
      <label htmlFor={"amendment-" + billId}>Proposed amendment</label>
      <textarea id={"amendment-" + billId} rows={4} minLength={20} maxLength={4000}
        value={text} onChange={event => { onTextChange(event.target.value); setPreview(false); }}
        placeholder="I would change this bill by…" required />
      <p className="amendment-hint">{trimmed.length}/4,000 characters · Minimum 20</p>
      <div className="amendment-actions">
        <button type="button" onClick={() => setPreview(value => !value)}
          disabled={trimmed.length < 20 || busy}>{preview ? "Hide preview" : "Preview amendment"}</button>
      </div>
      {preview && <div className="amendment-preview">
        <strong>Your proposed amendment (preview)</strong>
        <p>{text}</p><small>Preview only. It has not been submitted.</small>
      </div>}
      <label className="amendment-consent">
        <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        <span>Submit this text to Civic Synthesis for human review. It will be visible to authorized reviewers, not publicly published or applied to the law. I have not included private information.</span>
      </label>
      <button className="amendment-submit" type="submit"
        disabled={busy || !confirmed || trimmed.length < 20 || trimmed.length > 4000}>
        {busy ? "Saving amendment…" : "Submit proposed amendment"}
      </button>
    </form>
    {status && <p className="amendment-save-status" role="status">{status}</p>}
    {error && <p className="amendment-save-error" role="alert">{error}</p>}
    <p className="amendment-hint">Submitting does not change the bill, approve its revision, cast a vote, or initiate legislation. Amendments stay tied to revision <code>{revision.slice(0, 12)}…</code>.</p>
    <div className="amendment-history">
      <h4>Your submitted amendments</h4>
      {loading && <p role="status">Loading saved amendments…</p>}
      {loadError && <p role="alert">{loadError}</p>}
      {!loading && !loadError && entries.length === 0 && <p>You have no saved amendments for this revision.</p>}
      {entries.map(item => <article key={item.id}>
        <p><strong>{item.status === "pending_review" ? "Pending human review" : "Withdrawn"}</strong>
          <small> · {new Date(item.createdAt).toLocaleString()}</small></p>
        {item.status === "pending_review" && <p className="amendment-saved-text">{item.text}</p>}
        <p className="amendment-hint">Record: <code>{item.id}</code></p>
        {item.status === "pending_review" && <button type="button" disabled={busy || !!withdrawing}
          onClick={() => void withdraw(item.id)}>
          {withdrawing === item.id ? "Withdrawing…" : "Withdraw this amendment"}
        </button>}
      </article>)}
    </div>
  </section>;
}
