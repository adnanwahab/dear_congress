# Mini Symphony for Dear Congress

This local installation runs the shared HappyBearLandia Mini Symphony engine
against `adnanwahab/dear_congress`, base `main`, and the
[Civic Synthesis Linear board](https://linear.app/shel-bernstein/project/civic-synthesis-24f935081b94).
It has its own `.mini-symphony/` tasks, state, logs, worktrees and runner lock.
The HappyBearLandia queue and state are separate.

From the Dear Congress checkout:

```sh
bun run symphony:mini:check
bun run symphony:mini
```

The worker count defaults to one. Ctrl-C stops this project runner. The checked-in
app sources are not reset or committed by this command: new workers fetch origin
and branch from the current remote `main`. Existing worktrees retain prior edits.
The host publishes draft PRs only; successful Codex exit is not proof of acceptance.

Initial board import (November 13, 2026): SHE249 and SHE251 are In Review and
linked to existing PR1, which explicitly includes the SHE249 voting baseline.
Their local state records this real PR instead of dispatching duplicate work.
SHE252 is Done and disabled. The later launch-board refresh imported all15items,
with270/271/276/279/272/278enabled, four Duplicate tickets disabled,269held as
an umbrella and280held for production-deployment authorization. Existing PR1
remains linked to249/251. The shared tooling supports
separate follow-up IDs; do not delete PR/state history to force a duplicate.

## Refresh the board

The configured runner refreshes this project every60seconds between tasks when
`LINEAR_API_KEY` is available. Startup logs explicitly report whether refresh is
active or the credential is missing. Restart a running older bundle after its
current worker finishes to enable this behavior; editing tasks.json itself takes
effect in the already-running process. A failed refresh preserves local work.

For a manual refresh, stop this project runner first. Supply a Linear API key through your shell's
secret manager/environment as `LINEAR_API_KEY`; do not put it in tasks or config.

```sh
bun run symphony:mini:sync             # dry-run, no writes
bun run symphony:mini:sync --write     # refresh tasks and existing-PR receipts
bun run symphony:mini:check
bun run symphony:mini
```

The refresh queries only the configured project, paginates full descriptions,
checks open Dear Congress PRs, disables completed/deleted/dependency-held issues
and retains previous task flags and state. Newly imported, unblocked unfinished
issues are enabled; existing review PRs are held. The manual command is a dry-run unless --write is supplied;
the running engine uses the configured periodic refresh. Missing credentials/API failures leave the queue
unchanged. The import refuses a running project lock.

The bundled commands use Bun's `--no-env-file`; project workers also receive a
filtered CLI/runtime environment excluding application database, bot and Linear
keys, even if a parent shell or package runner loaded the app environment. Normal Codex and GitHub CLI authentication
must already be configured. Workers do not copy local `.env` files or app data.
SHE249's question about automatic merging is not authority to enable live merges;
preserve the existing voting/auth/check policy. This installation changes no live
voting, merge, external-message or deployment configuration.

## Installation ownership

The engine sources remain in HappyBearLandia at `tools/symphony/mini-bun/`.
The local `.mini-symphony/runner.js` and `import-linear.js` are generated Bun
bundles. Config, queue, state and those bundles are ignored by Git. To update the
engine, rebuild these two bundles from that shared source into `.mini-symphony/`.
Do not replace tasks/state when updating the engine. A fresh clone needs this
local tool installation before the package commands can run.

## Session measurement and text logs

The updated runner creates a unique session ID on each start and writes a readable
`.mini-symphony/telemetry/sessions/<id>/session.log` plus ordered `events.jsonl`.
The HappyBearLandia `/mini-symphony` dashboard reads this project separately.
It distinguishes continuous runtime, worker-active time, publishing, waiting,
unknown heartbeat intervals and confirmed new PR receipts. Old task state is
legacy history and cannot prove a historical25-hour run. Let the current worker
finish, then restart the runner to load instrumentation; the current process is
not interrupted or backfilled. The default one-hour timeout applies per Codex
task, not to the coordinator session.
