/** Fictional exercise only. Units and constraints have no civic/model identity. */
export const COALITION_BUDGET = 12;
export const COALITION_OPTIONS = [
  { id: 'access', title: 'Step-free entrance', cost: 4, tradeoff: 'Construction disrupts the entrance for one week.' },
  { id: 'evening', title: 'Evening opening', cost: 5, tradeoff: 'Evening activity adds noise after 8 pm.' },
  { id: 'quiet', title: 'Sound insulation', cost: 3, tradeoff: 'Insulation uses funds that could buy garden space.' },
  { id: 'garden', title: 'Community garden', cost: 4, tradeoff: 'Garden space reduces the indoor activity area.' },
] as const;
export type CoalitionOption = typeof COALITION_OPTIONS[number]['id'];
export type CoalitionAssumptions = { accessRequired: boolean; eveningRequired: boolean; quietRequired: boolean };
export const DEFAULT_COALITION_ASSUMPTIONS: CoalitionAssumptions = { accessRequired: true, eveningRequired: true, quietRequired: true };
export function evaluateCoalition(selected: CoalitionOption[], assumptions: CoalitionAssumptions, acknowledged: CoalitionOption[]) {
  const items = COALITION_OPTIONS.filter(option => selected.includes(option.id));
  const cost = items.reduce((sum, option) => sum + option.cost, 0);
  const constraints = [
    { name: 'Mira · access circle', requirement: assumptions.accessRequired ? 'Requires a step-free entrance.' : 'No entrance requirement.', met: !assumptions.accessRequired || selected.includes('access') },
    { name: 'Sol · night-shift club', requirement: assumptions.eveningRequired ? 'Requires evening opening.' : 'No opening-hours requirement.', met: !assumptions.eveningRequired || selected.includes('evening') },
    { name: 'Tavi · quiet neighbors', requirement: assumptions.quietRequired ? 'Evening opening requires sound insulation.' : 'No noise requirement.', met: !assumptions.quietRequired || !selected.includes('evening') || selected.includes('quiet') },
  ];
  const feasible = cost <= COALITION_BUDGET && constraints.every(constraint => constraint.met);
  const missingTradeoffs = items.filter(item => !acknowledged.includes(item.id));
  return { cost, constraints, feasible, missingTradeoffs, won: feasible && items.length > 0 && missingTradeoffs.length === 0 };
}
