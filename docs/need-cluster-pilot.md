# Private need clustering pilot

This first SHE-304 slice runs against the existing journal DB shape, separately
from the server. It groups **exact original wording only**; it does not infer
shared intent, merge need IDs, modify `/needs` demand or establish verified people.
All groups are pending private human review. There is no publication operation.

Use disposable, access-controlled snapshots, never a production database path.
Run `bun run clusters:pilot snapshot.json manifest.json` to print a private JSON
sidecar to stdout. Keep stdout and manifests private: IDs, hashes, locality and
excluded-entry references can identify sensitive records even without excerpts.
Do not commit real snapshots, authorization records or output.

The snapshot is `{ "entries": [...] }` using `JournalEntry` from
`src/engine/types.ts`; other DB fields are ignored. The manifest shape is:

```json
{
  "repository": "adnanwahab/dear_congress",
  "taxonomyVersion": "pilot-1",
  "localityVersion": "operator-verified-1",
  "topicIds": ["transport"],
  "authorizations": [{
    "entryId": "disposable-example",
    "revision": "sha256 returned by journalRevision(entry)",
    "consent": "granted",
    "locality": "Houston"
  }]
}
```

An operator must independently obtain consent for private clustering and verify
locality and real-source eligibility before adding an authorization. This file
is a trusted offline input, not a browser-supplied identity or consent API. Do not
infer provenance from the client-controlled `source` or synthetic flags. Absent
consent infrastructure, use disposable fixtures only. Consent is bound to the
current journal revision; changed wording, labels or moderation invalidate it.
Only explicitly published entries with a single allowed topic are eligible.
Seeded/synthetic entries, missing locality, ambiguous topics and missing/stale/
withdrawn consent are excluded. Timestamps must use UTC ISO strings with `Z`;
windows are half-open UTC calendar months. No residence inference is attempted.

A reviewer can reproduce the walkthrough with
`bun test src/server/need-clusters/pilot.test.ts`: the CLI test writes a disposable
DB and manifest, runs the actual command and verifies the DB is unchanged.
Review members by protected source ID/revision, inspect the reason and uncertainty,
and compare exclusions privately. Original text remains exclusively in the source
snapshot. Exemplars are always empty and distinct-participant counts unavailable.
Reversing entries/authorizations reproduces the result. Withdrawal removes a
member on the next run and changes the run ID; old private output must be retired
under the pilot's retention rules. No cache invalidation/publication is implied.

The model version pins exact string matching (including case/punctuation), source
client separation and UTC month partitioning. Snapshot/configuration digests and
sorted IDs make replay deterministic. This conservative baseline intentionally
misses paraphrases and cannot measure semantic quality. Pending state is a queue
artifact, not a durable moderation decision or approval workflow.

Remaining: consent capture and trusted provenance, semantic matching, authorized
exemplars, ownership-protected challenges and receipts, persisted human decisions
and merge/split history, `/needs` integration and accessibility walkthrough,
1M streaming fixture and benchmark, and maintainer-identified live source checks.
No full SHE-304 acceptance, public walkthrough or live verification is claimed.
Existing governance, authentication, ballots and release policy remain unchanged;
see `docs/launch-merge-policy.md` for preserved defaults and human review controls.
