/** Versioned local simulator fixture. No live journals, votes or package effects. */
export const STORY_ASSUMPTIONS = {
  id: 'household-ledger-v1',
  populationId: 'synthetic-households-v1',
  seed: 428,
  populationSize: 3,
  initialBalance: 100,
  monthlyIncome: 2000,
  monthlyRent: 900,
  otherMonthlyCosts: 1000,
  months: 3,
} as const;
export type HouseholdEvent = {
  id: string;
  month: number;
  kind: 'income' | 'rent' | 'other-costs' | 'demo-credit';
  change: number;
  balance: number;
};
export type HouseholdRun = {
  id: string;
  householdId: string;
  assumptions: typeof STORY_ASSUMPTIONS;
  monthlyCredit: number;
  initialBalance: number;
  events: HouseholdEvent[];
};
export const STORY_HOUSEHOLDS = Array.from({ length: STORY_ASSUMPTIONS.populationSize }, (_, index) =>
  `demo-household-${String(index + 1).padStart(3, '0')}`);
export const DEFAULT_STORY_HOUSEHOLD = STORY_HOUSEHOLDS[STORY_ASSUMPTIONS.seed % STORY_HOUSEHOLDS.length]!;

/** Each narrated line is a ledger event with its resulting modeled state. */
export function simulateHouseholdPair(householdId: string): [HouseholdRun, HouseholdRun] {
  if (!STORY_HOUSEHOLDS.includes(householdId)) throw new Error('Unknown synthetic household');
  return [0, 150].map(monthlyCredit => {
    const id = monthlyCredit ? 'demo-credit' : 'demo-baseline';
    // Stable household variation; both futures start with identical state.
    const initialBalance = STORY_ASSUMPTIONS.initialBalance + STORY_HOUSEHOLDS.indexOf(householdId) * 25;
    let balance = initialBalance;
    const events: HouseholdEvent[] = [];
    for (let month = 1; month <= STORY_ASSUMPTIONS.months; month++) {
      const changes: [HouseholdEvent['kind'], number][] = [
        ['income', STORY_ASSUMPTIONS.monthlyIncome],
        ['rent', -STORY_ASSUMPTIONS.monthlyRent],
        ['other-costs', -STORY_ASSUMPTIONS.otherMonthlyCosts],
      ];
      if (monthlyCredit) changes.push(['demo-credit', monthlyCredit]);
      for (const [kind, change] of changes) {
        balance += change;
        events.push({ id: `${id}/${householdId}/${month}/${kind}`, month, kind, change, balance });
      }
    }
    return { id, householdId, assumptions: STORY_ASSUMPTIONS, monthlyCredit, initialBalance, events };
  }) as [HouseholdRun, HouseholdRun];
}
