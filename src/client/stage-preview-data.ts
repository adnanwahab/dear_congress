import { CIVIC_STAGES } from '../shared/civic-stages';

/** Only authored plain text, never destination HTML or resident data. */
export function stageSummary(route: string) {
  const stage = CIVIC_STAGES.find(stage => stage.route === route);
  if (!stage) throw new Error('Unknown stage');
  return { n: stage.n, title: stage.title, heading: stage.heading, description: stage.description };
}
