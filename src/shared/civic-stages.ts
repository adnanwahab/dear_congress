export type Stage = 'published' | 'feed' | 'votes' | 'draft' | 'sponsors' | 'outcomes';
export const STAGES: Record<Stage, { n: number; route: string; title: string; heading: string; description: string; time: string; next: Stage }> = {
  published: { n: 1, route: '/published', title: 'Published', heading: 'Start with the source.', description: 'Explore the official institutions behind each sample scenario. Reference links provide background; the sample proposals are fictional.', time: 'Clock starts', next: 'feed' },
  feed: { n: 2, route: '/feed', title: 'Feed', heading: 'Make sense of what could change.', description: 'Find a proposal by topic, read its plain-English summary, and choose the change you want to explore.', time: 'Same day', next: 'votes' },
  votes: { n: 3, route: '/votes', title: 'Votes', heading: 'Add your voice to a proposal.', description: 'Read the change, make an advisory choice, and change your vote at any time. Sample tallies are illustrative, not a public poll.', time: 'Open 7 days', next: 'draft' },
  draft: { n: 4, route: '/draft', title: 'Draft', heading: 'Turn a shared need into clear text.', description: 'Compare the illustrative current approach with a proposed clause, review the summary, and prepare a downloadable sample draft.', time: 'Every week', next: 'sponsors' },
  sponsors: { n: 5, route: '/sponsors', title: 'Sponsors', heading: 'Give every draft a next step.', description: 'Choose a possible office and walk a sample draft through preparation and follow-up. Nothing is sent to a public office.', time: 'Within a week', next: 'outcomes' },
  outcomes: { n: 6, route: '/outcomes', title: 'Outcomes', heading: 'Keep the story moving.', description: 'Review simulated replies, committee introductions, and stalled items. Record a clear next step rather than letting a draft disappear.', time: 'Tracked weekly', next: 'feed' },
};
export const CIVIC_STAGES = Object.values(STAGES).sort((a, b) => a.n - b.n);
export const stageRoute = (stage: Stage, id?: string | null) => `${STAGES[stage].route}${id ? `?proposal=${encodeURIComponent(id)}` : ''}`;
