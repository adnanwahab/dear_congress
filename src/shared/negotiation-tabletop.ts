/** Entirely fictional fixture, independent of catalog, legal text and ballots. */
export const tabletopDefaults = { budget: 6000, grant: 1000, ceiling: 30000 };
export type TabletopParameters = typeof tabletopDefaults;
export const tabletopHouseholds = [15000, 25000, 35000, 45000, 55000, 65000];
export function previewTabletop(parameters: TabletopParameters) {
  const { budget, grant, ceiling } = parameters;
  if (!Number.isInteger(budget) || budget < 0 || budget > 12000 || budget % 1000 ||
      !Number.isInteger(grant) || grant < 500 || grant > 2000 || grant % 500 ||
      !Number.isInteger(ceiling) || ceiling < 20000 || ceiling > 70000 || ceiling % 10000) throw new Error('Unsupported tabletop parameters');
  const eligible = tabletopHouseholds.filter(income => income <= ceiling).length;
  const cost = eligible * grant;
  return { eligible, excluded: tabletopHouseholds.length - eligible, cost, balance: budget - cost, fits: cost <= budget };
}
export function tabletopDraft(parameters: TabletopParameters) {
  return { schemaVersion: 'dear-congress-negotiation-draft.v1', status: 'unsigned proposal draft',
    sourceRepository: 'adnanwahab/dear_congress', fixture: 'fictional-six-households.v1',
    parameters: { ...parameters }, result: previewTabletop(parameters),
    assumptions: 'USD per year. Six fictional households with incomes 15000, 25000, 35000, 45000, 55000, 65000. Income <= ceiling qualifies; cost = eligible count × annual grant. No rationing or automatic selection when over budget.',
    evidenceAbsent: 'No real household data, fiscal estimate, take-up, administrative costs, legal eligibility review or distributional evidence. No welfare or civic outcomes modeled.',
    authority: 'Demo only; no signature, verified civic participation, recorded vote, legal amendment or approval.' };
}
