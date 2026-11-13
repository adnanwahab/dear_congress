/** Public help copy. Keep trust wording aligned with privacy-page and SHE-318 review. */
export const PUBLIC_GUIDE = `# How Civic Synthesis works

Civic Synthesis is an independent civic prototype, not a government service, election, or official channel to an office. You can read without participating. This guide describes the prototype, not a promise that a proposal will become law.

## Choose a safe starting path

- Read: open the [proposal feed](/feed) or [published sources](/published). Check each item's source and sample label before relying on it.
- Respond: open [advisory votes](/votes), read the proposal, and choose support, oppose, or unsure. You can change or remove your response. No identity documents are needed.
- Journal: open [Journal](/journal). Write only what you are comfortable sharing publicly. The draft stays in page memory until submission and is lost on reload. Review the public notice before publishing; you may select labels without automatic inference.

## Does my vote count?

An advisory vote records a preference inside this prototype. It does not cast an official ballot, enact law, authorize spending, contact an office, or approve a code merge. Saved browser choices and fictional sample totals are displayed separately. Neither is a verified count of people or an official public poll.

A signed browser cookie lets you change your saved choice. Clearing cookies or using another browser can create another identity; this does not prove one person, one vote. Read [participation and privacy](/account). On proposal cards, remove your selected response to withdraw it. The separate [civic policy sandbox](/vote) has option changes saved with Save votes; see [withdrawal instructions](/privacy).

Repository developer previews have separate identities and revision-bound ballots. Browser advisory responses never become verified merge authority. A human maintainer must review code and decide whether to merge; a successful test, simulation or draft PR is not acceptance.

## What is fictional and what is verified?

Sample proposals, sample tallies, simulated residents, illustrative costs and future scenarios demonstrate how the tools work. They are not enacted laws, measured public opinion, legal advice, or predictions. [Explore civic plans](/synth) can combine journal inputs with deterministic simulated residents; inspect the simulated-data controls and labels before comparing results.

Official bill metadata on [Published](/published) is a separate source-backed reference. The official lane may be empty until an operator imports a record. Follow its original source link and check jurisdiction, reported action and retrieval date. Imported detail metadata does not verify current legal status, enactment or effective dates. A real institution's link provides background; it does not verify the fictional proposal beside it. Unavailable or stale information is not proof of a current official status.

## Will my journal be public?

Yes, if you publish it. Published text, display name, time, source labels and needs can be read by anyone, including through public APIs and copies made by other sites. Do not put addresses, contact details or sensitive information in the text. Approximate map handling cannot remove a location you type into a public entry.

The Journal path lets you publish without automatic inference. Other journal interfaces may send text to a configured AI provider for needs extraction; local extraction is used without provider credentials. Review the [privacy and removal notice](/privacy) for processing and retention boundaries. This is not a private diary service.

In the publishing browser, use Delete my entry in [Journal](/journal) to remove an owned entry from the active feed, public APIs and future needs calculations. Losing that browser's cookie may prevent self-service deletion. Independently published proposals and their ballots are not rewritten when a source journal is deleted. Backups, logs and other people's copies may remain; there is no guaranteed deletion schedule for those copies. The privacy notice explains removal requests and their public GitHub channel.

## What happens next?

Follow one sample proposal from [Feed](/feed) to [Votes](/votes), [Draft](/draft), [Sponsors](/sponsors), and [Outcomes](/outcomes). Keep the same selected proposal and compare its text and status at each step. Drafts are examples; sponsor preparation sends nothing to a public office. Sample replies, introductions and stalled items are simulated, not evidence of government action.

The Outcomes measurement prototype also uses explicitly synthetic metrics. It has no verified implemented policy registered. A simulated improvement does not establish a real-world result. For a real bill, follow its exact official source from Published to verify status. A real outcome needs a named policy, implementation evidence, dated measurements, baseline and source; missing evidence means unknown, not success. There is no promised timetable for passage or implementation.

## Sources and methodology

- [Published](/published) separates official bill metadata from fictional scenarios. Use each record's original link for its exact source rather than treating a summary as law.
- [Shared needs](/needs) groups journal inputs and priorities; extraction can be mistaken. Check the original text and correct labels where offered.
- [Civic plans](/synth) score options under chosen weights and budget. Support, welfare, fairness, feasibility and evidence are model inputs, not independent verification. Costs and legal details in sample options are illustrative.
- [Outcomes](/outcomes) separates simulated outreach from synthetic measurement examples. Compare the baseline, source history, freshness and missing-data labels before interpreting a change.
- [Journal API documentation](/api-docs) describes publication interfaces. [Build version](/version) identifies the running revision; [service health](/healthz) reports service availability, not policy success or acceptance.

## Simple glossary

- Advisory vote: a recorded preference with no official or binding effect.
- Proposal: a suggested change, not an enacted law.
- Jurisdiction: the place and level of government responsible for a subject.
- Simulation: a model's example of what might happen, not a measured result.
- Source: the original record supporting a claim; check its date and exact version.
- Revision: a particular version of text or code. Review of an older version does not approve a newer one.
- Quorum: the minimum participation required by a stated decision rule; it does not make browser votes verified.
- Public entry: content that anyone can read and copy after publication.

## About, feedback and language access

This independent prototype explores how everyday needs can inform discussion and illustrative civic plans. [Project background and source code](https://github.com/adnanwahab/dear_congress#readme) explain the project. [Send feedback](https://github.com/adnanwahab/dear_congress/issues/new) through a public GitHub issue; an account is required. Do not include private journal text or cookie identifiers. A dedicated About/contact experience is tracked separately in SHE-285; no private contact channel is currently published.

[Privacy and removal](/privacy) and [participation boundaries](/account) describe the current privacy and consent limits. No separate legal terms route is published here; this prototype does not replace official legal or election information.

This guide uses plain English. Human-reviewed Spanish and broader plain-language access remain pending under [SHE-318](https://linear.app/shel-bernstein/issue/SHE-318/access-human-reviewed-spanish-translation-and-plain-language-civic). No approved Spanish translation is available here yet. Changes to vote, publication, source and deletion wording need the same translation review before they can be labeled reviewed.
`;
