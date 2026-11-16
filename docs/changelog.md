# Public launch changelog

The read-only `/changelog` handler is in `src/server/changelog.ts`. `/version`
retains its JSON identity fields and adds a relative changelog link. The shared
HTML footer links both. No resident records, telemetry, credentials or upstream
requests are used. Responses are no-store; GET and HEAD are supported.

The initial historical entry uses the locally resolved v2026.11.14 tag and the
source's dated test report. It describes only that commit's final correction,
not the complete release delta. Hosted CI and incident coverage are explicitly
unattested. The rollout account is pinned to a separate source revision because
it was written after the release. A matching serving SHA proves only identity.
Missing or different identity must never be presented as a new tested rollout.

For each future editorial entry, review and commit the explicit release date
(and UTC publication time when known), full release SHA, human-published tag,
comparison base and changed paths, revision-bound test report/run evidence, and
any reliability incident/correction record. Distinguish demo revisions from
operational status reports. Label unavailable evidence and incident coverage;
never infer incident-free service from absence of records. Do not label local
tests hosted CI or source accounts independent deployment attestations. Preserve
old entries and dates when adding corrections. Never claim civic participation,
enactment, government endorsement or policy outcomes from code or sharing.

Existing governance defaults and launch controls remain as documented in
launch-merge-policy.md: disabled/dry-run automation, quorum 10, kill switch active,
current-head checks and human review. This feature changes no voting, auth,
release workflow, protection settings or production data. Human-published tagged
releases and maintainer approval remain required; repository files do not verify
live protection settings.

Human acceptance should ask visitors whether an unmatched shared preview means a
new release, where they can check the exact source and dates, and whether the
update demonstrates policy success. Record usefulness and comprehension findings
separately; no sharing or engagement metric establishes meaningful participation.
