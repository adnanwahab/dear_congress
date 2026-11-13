/** Shared visual identity. Icons are SVG path data in a 24 × 24 viewBox. */
export const TOPICS = [
  { id: 'housing', label: 'Housing', color: '#1e40af', icon: 'M3 11 12 3 21 11 M5 10v11h14V10 M10 21v-7h4v7' },
  { id: 'childcare', label: 'Childcare', color: '#9d174d', icon: 'M8 9a4 4 0 1 1 8 0 M5 21v-3a7 7 0 0 1 14 0v3 M9 9h.01 M15 9h.01 M10 12q2 2 4 0' },
  { id: 'transit', label: 'Transit', color: '#155e75', icon: 'M5 17V5q7-4 14 0v12Z M5 10h14 M8 14h.01 M16 14h.01 M7 17v4 M17 17v4' },
  { id: 'climate', label: 'Climate', color: '#166534', icon: 'M4 20 17 7 M4 15C2 5 10 3 21 3c0 12-4 18-13 15' },
  { id: 'health', label: 'Health', color: '#991b1b', icon: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z' },
  { id: 'food-access', label: 'Food access', color: '#854d0e', icon: 'M12 8C5 3 1 10 6 19q3 4 6 1 3 3 6-1c5-9 1-16-6-11Z M12 8V3 M12 5q4 0 5-3' },
  { id: 'small-business', label: 'Small business', color: '#6b21a8', icon: 'M3 10 5 3h14l2 7 M3 10q3 4 6 0 3 4 6 0 3 4 6 0 M5 13v8h14v-8 M9 21v-6h6v6' },
  { id: 'government', label: 'Government', color: '#374151', icon: 'M2 8 12 2 22 8Z M5 11v8 M12 11v8 M19 11v8 M2 22h20' },
] as const;
export function getTopic(label?: string) { return TOPICS.find(t => t.label === label); }
const NEED_TOPICS: Readonly<Record<string, string>> = {
  'Affordable childcare': 'Childcare', 'Housing affordability': 'Housing',
  'Reliable transit': 'Transit', 'Affordable healthcare': 'Health',
  'Mental-health access': 'Health', 'Small-business burden': 'Small business',
  'Flood protection': 'Climate', 'Property insurance costs': 'Housing', 'Food access': 'Food access',
};
export function topicForNeed(label: string) { return NEED_TOPICS[label]; }
/** Legacy walkthrough cards have explicit identities, never inferred from titles. */
const SAMPLE_TOPICS: Readonly<Record<string, string>> = {
  'sample-drainage': 'Climate', 'sample-crossings': 'Transit', 'sample-food': 'Food access',
};
export function topicForProposal(id: string, items: readonly { id: string; topic: string }[]) {
  return items.find(i => i.id === id)?.topic ?? SAMPLE_TOPICS[id];
}
