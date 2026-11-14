# Federal metadata import — SHE-314 first slice

This opt-in, single-bill importer integrates Congress.gov **detail metadata** into
`/published`, `/feed` and `/outcomes`, through read-only `GET /api/legislation`.
No seed record is presented as fetched official evidence. The default lane is empty.
It does not determine current legal status, enactment or effective dates. A dated
introduced-bill record can describe a measure that subsequently became law.
The UI explicitly says current legal status is unverified, even after a successful
metadata refresh. The latest action is quoted as reported metadata, not mapped
into a legal assertion.

## Local operator use

With a legitimate Congress.gov API key already in the environment:

```sh
# Congress, bill type (hr or s), bill number. Select the intended measure explicitly.
bun scripts/import-bill.ts 119 hr 123
```

`CONGRESS_API_KEY` is required only by this CLI, never sent to the browser.
`LEGISLATION_PATH` defaults to `data/legislation` for both importer and server.
Use a disposable local path for development. No public write/refresh API, scheduler,
production refresh, credential creation or deployment is included. The command
makes one request with a 15-second timeout and 2 MB streaming limit; redirects are
refused. API errors produce a generic message and a failed attempt, with no raw
error URL or credentials. Responses containing API key material are rejected.
No retries or list pagination are implemented; there is no complete catalog claim.

The adapter follows the [official bill endpoint contract](https://github.com/LibraryOfCongress/api.congress.gov/blob/main/Documentation/BillEndpoint.md),
rechecked November 13, 2026. Supported scope is House/Senate bills from Congress 93
onward. Joint/concurrent/simple resolutions are rejected pending their own mapping.
The archive is independent of the application database, citizen proposals, votes,
repository IDs, PR revisions and receipts. It never supplies governance evidence.

## Evidence and failure behavior

Exact valid UTF-8 JSON bytes are retained at `raw/<sha256>.json` with exclusive
creation. Source corrections at an unchanged endpoint produce new hashes; duplicate
bytes reuse their archive. Each successful or failed attempt gets a separate file,
including identity, time, parser version and credential-free source endpoint.
A reader validates the stored raw hash and reparses identity-bound metadata.
Corrupt or unreadable archives return HTTP 503 with `no-store`; they are never
presented as a successful fresh result. Partial attempt files also fail closed.
Keep a single local importer writer per measure and retain/back up this directory;
filesystem access can still tamper with it. This is append-only application behavior,
not a WORM archive or cryptographic proof of source authenticity.

The latest attempt is ordered by attempt start time, so a late old response cannot
replace a newer observation. Failed attempts never advance last-good check time;
retained records show refresh failure. No prior success shows an unavailable/empty
lane, never withdrawal. Metadata expires at 24 hours and age is recomputed in the
browser every minute, including when no importer runs. The UI polls the read API
once a minute, so another process's failure becomes visible at the next poll.
Future/malformed check timestamps are unavailable. Cache age and upstream update
are distinct. Metadata-only time never represents a full text/legal-status check.

## Remaining acceptance

Full-text retrieval and original document downloads, revision/amendment linking,
readable diffs, complete actions and chamber-specific history, reviewed legal-status
mapping (including enactment and withdrawal), effective-date citations, sponsor IDs,
related/reintroduced relationships, source-correction flags, source authenticity and
licensing review, configurable refresh policy, catalog reconciliation, retry budgets,
city/state adapters and persistent multi-writer storage remain future work.
Synthetic shape fixtures exercise identity, conservative non-classification and
failure handling; they are not recorded official responses or provenance review.
Native 390px/200% zoom, keyboard/screen-reader and recovered production-equivalent
verification remain required. This slice does not establish SHE-314 acceptance.

Governance is unchanged: disabled/dry-run, quorum 10, 24-hour exposure, one
current-head approval, strict majority, fail-closed base/check allowlists and the
existing kill switch. Main requires the three launch checks and human approval;
remote protection and production overrides remain unverified. Human review and
merge are required; tagged human-published releases remain separately gated.
