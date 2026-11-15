import type { Stage } from '../shared/civic-stages';
export type TriviaQuestion = { id: string; stage: Stage; prompt: string; choices: readonly string[]; answer: number; explanation: string; source: { title: string; url: string } };
export type TriviaTopic = { title: string; questions: readonly TriviaQuestion[] };
const council = { title: 'City of Houston · City Council', url: 'https://www.houstontx.gov/council/' };
const budget = { title: 'City of Houston · Operating budgets', url: 'https://www.houstontx.gov/budget/' };
function q(id: string, stage: Stage, prompt: string, choices: string[], answer: number, explanation: string, source = council): TriviaQuestion { return { id, stage, prompt, choices, answer, explanation, source }; }
/** Neutral knowledge checks, not preferences. Source links checked November 14, 2026. */
export const TRIVIA_TOPICS: readonly TriviaTopic[] = [
  { title: 'Who represents Houston?', questions: [
    q('at-large', 'published', 'What does an at-large Houston council member represent?', ['One street', 'The city as a whole', 'Only city employees'], 1, 'At-large seats represent the whole city. District seats represent geographic areas.'),
    q('district', 'feed', 'Which seat is tied to a geographic area within Houston?', ['District council seat', 'At-large council seat', 'Every federal seat'], 0, 'Houston distinguishes geographic district seats from city-wide at-large seats.'),
    q('terms', 'votes', 'How long is a regular Houston council term?', ['One month', 'Ten years', 'Four years'], 2, 'The city describes four-year terms. This is an official election term, unrelated to choices in this prototype.'),
    q('lookup', 'sponsors', 'Before choosing a possible council contact, what should you check?', ['Which option won a game', 'The official district and at-large listings', 'Only a fictional proposal tally'], 1, 'The council directory identifies district and at-large offices. Use official listings to investigate representation; a game score supplies no authority.'),
    q('inference', 'outcomes', 'Does an official council directory prove a sample proposal became law?', ['No; it identifies offices', 'Yes, every sample is enacted', 'Only if you score five points'], 0, 'The directory lists representatives and contact information, not enactment evidence for a sample proposal.'),
  ] },
  { title: 'Follow the public budget', questions: [
    q('fiscal', 'published', 'How are Houston operating budgets organized on the official site?', ['By game score', 'By fiscal year', 'By browser theme'], 1, 'The operating-budget page groups adopted budgets and monthly financial reports by fiscal year.', budget),
    q('adopted', 'draft', 'To examine an adopted operating budget, which document category should you choose?', ['A sample discussion draft', 'A fictional tally', 'Fiscal year adopted budget'], 2, 'The official page labels adopted budgets separately from monthly financial reports. A discussion draft is not that record.', budget),
    q('compare', 'feed', 'When comparing two budget documents, what should you check first?', ['Their fiscal years and document types', 'Their file colors', 'Your arcade score'], 0, 'The page includes multiple years and both adopted budgets and monthly reports. Match periods and document types before comparing.', budget),
    q('monthly', 'outcomes', 'Where would you start looking for a dated financial update?', ['The council member directory alone', 'Fiscal year monthly financial reports', 'A simulated sponsor reply'], 1, 'The budget page links dated monthly financial reports by fiscal year. A financial report alone does not prove a policy caused an outcome.', budget),
    q('reason', 'votes', 'Does the existence of a budget document tell you which policy you should support?', ['Yes, it chooses your views', 'Yes, if a quiz says so', 'No; inspect evidence and trade-offs yourself'], 2, 'The page supplies financial documents, not a test of political beliefs. Use the relevant records to inform your own reasoning.', budget),
  ] },
];
export function validateTopics(topics: readonly TriviaTopic[]): void {
  if (!topics.length || topics.some(t => t.questions.length !== 5 || t.questions.some(q => !q.explanation || !q.choices[q.answer] || !q.source.url.startsWith('https://')))) throw new Error('Question bank unavailable');
}
