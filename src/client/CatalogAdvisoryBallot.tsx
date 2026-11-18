import { useEffect, useState } from "react";

type Choice = "support" | "oppose" | "unsure";
interface BallotStatus {
  billId: string;
  revision: string;
  state: string;
  publication: null | { id: string; revision: string; opensAt: string; closesAt: string };
  counts: null | { support: number; oppose: number; unsure: number; total: number };
  ownChoice: Choice | null;
  electorate: "unverified_browser_identities";
  binding: false;
}
const titles: { choice: Choice; label: string }[] = [
  { choice: "support", label: "Yes" },
  { choice: "oppose", label: "No" },
  { choice: "unsure", label: "Unsure" },
];
async function readStatus(billId: string, signal?: AbortSignal): Promise<BallotStatus> {
  const response = await fetch("/api/catalog-bills/" + encodeURIComponent(billId) + "/ballot", {
    credentials: "same-origin", cache: "no-store", signal,
  });
  if (!response.ok) throw new Error("Ballot status is temporarily unavailable.");
  return await response.json() as BallotStatus;
}
export function CatalogAdvisoryBallot({ billId, revision }: { billId: string; revision: string }) {
  const [ballot, setBallot] = useState<BallotStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setBallot(null); setError(""); setReceipt("");
    void readStatus(billId, controller.signal).then(setBallot).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Ballot status unavailable.");
    });
    return () => controller.abort();
  }, [billId, revision]);
  async function cast(choice: Choice | null) {
    if (!ballot || ballot.state !== "open" || !ballot.publication || busy) return;
    setBusy(true); setError(""); setReceipt("");
    const requestId = crypto.randomUUID();
    try {
      const response = await fetch("/api/catalog-bills/" + encodeURIComponent(billId) + "/ballot", {
        method: "PUT", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision, publicationId: ballot.publication.id, choice, requestId }),
      });
      const data = await response.json() as { saved?: boolean; receipt?: { id: string }; error?: string };
      if (!response.ok || !data.saved || !data.receipt?.id)
        throw new Error(data.error || "Vote was not confirmed. Please check before retrying.");
      // Receipt is the server's acknowledgment; never claim success on click alone.
      setReceipt(data.receipt.id);
      setBallot(await readStatus(billId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vote status is unknown. Reload to verify before submitting again.");
    } finally { setBusy(false); }
  }
  return <section className="votes-response" aria-label="Catalog advisory participation">
    <h3>What do you think?</h3>
    {!ballot && !error && <p role="status">Checking whether this bill is open for advisory voting…</p>}
    {error && <p role="alert">{error}</p>}
    {ballot && ballot.state !== "open" && <p role="status">
      This revision is {ballot.state === "awaiting_review" ? "awaiting human review" : ballot.state === "awaiting_publication" ? "awaiting authorized publication" : ballot.state === "scheduled" ? "scheduled for a later advisory vote" : "not currently open for advisory voting"}.
      No catalog vote has been submitted.
    </p>}
    {ballot?.state === "open" && ballot.publication && <div>
      <p>Non-binding advisory poll about this exact reviewed proposal revision. Participation is voluntary; one choice per unverified browser identity, not one verified person or a government election.</p>
      <div className="votes-choice-row" role="group" aria-label="Your advisory choice">
        {titles.map(item => <button key={item.choice} type="button"
          aria-pressed={ballot.ownChoice === item.choice} disabled={busy}
          onClick={() => void cast(item.choice)}>{item.label}</button>)}
      </div>
      {ballot.ownChoice && <button type="button" disabled={busy} onClick={() => void cast(null)}>Withdraw my choice</button>}
      {busy && <p role="status">Saving your advisory choice…</p>}
      {receipt && <p role="status">Saved by server. Receipt: <code>{receipt}</code></p>}
      <p>Current browser responses: {ballot.counts?.support ?? 0} support · {ballot.counts?.oppose ?? 0} oppose · {ballot.counts?.unsure ?? 0} unsure.
        These counts are not verified turnout or representative opinion.</p>
      <small>Advisory window closes {new Date(ballot.publication.closesAt).toLocaleString()}.</small>
    </div>}
  </section>;
}
