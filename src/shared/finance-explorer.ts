/** Isolated teaching fixture. Never an appropriation, award, outlay or catalog cost. */
export interface FinanceAgency {
  id: string; label: string; level: string; received: number; spending: number;
  transfers: { to: string; amount: number }[];
}
export interface FinanceDataset {
  id: string; period: string; basis: string; unit: string; checkedAt: string | null;
  agencies: FinanceAgency[];
}
export const financeExample: FinanceDataset = {
  id: 'hypothetical-finance-v1', period: 'Hypothetical year', basis: 'cash', unit: 'USD millions', checkedAt: null,
  agencies: [
    { id: 'example-federal', label: 'Example federal agency', level: 'Federal', received: 100, spending: 0, transfers: [{ to: 'example-state', amount: 100 }] },
    { id: 'example-state', label: 'Example state program', level: 'State', received: 100, spending: 10, transfers: [{ to: 'example-county', amount: 80 }] },
    { id: 'example-county', label: 'Example county program', level: 'County', received: 80, spending: 15, transfers: [{ to: 'example-city', amount: 60 }] },
    { id: 'example-city', label: 'Example city program', level: 'City', received: 60, spending: 50, transfers: [] },
  ],
};
export function reconcileFinance(data: FinanceDataset) {
  const ids = new Set(data.agencies.map(a => a.id));
  if (ids.size !== data.agencies.length) throw new Error('Duplicate agency identity');
  const incoming = new Map<string, number>();
  for (const agency of data.agencies) {
    for (const value of [agency.received, agency.spending, ...agency.transfers.map(t => t.amount)]) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid accounting amount');
    }
    const targets = new Set<string>();
    for (const t of agency.transfers) {
      if (!ids.has(t.to) || targets.has(t.to) || t.to === agency.id) throw new Error('Invalid transfer identity');
      targets.add(t.to); incoming.set(t.to, (incoming.get(t.to) ?? 0) + t.amount);
    }
  }
  // Reject cycles before claiming consolidated reconciliation.
  const visited = new Set<string>(), visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('Transfer cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    data.agencies.find(a => a.id === id)!.transfers.forEach(t => visit(t.to));
    visiting.delete(id); visited.add(id);
  }
  data.agencies.forEach(a => visit(a.id));
  let cumulative = 0;
  const rows = data.agencies.map(a => {
    if (incoming.has(a.id) && incoming.get(a.id) !== a.received) throw new Error('Unmatched transfer receipt');
    const transferred = a.transfers.reduce((sum, t) => sum + t.amount, 0);
    const unresolved = a.received - transferred - a.spending;
    if (unresolved < 0) throw new Error('Uses exceed receipts');
    const start = cumulative; cumulative += a.spending;
    return { ...a, transferred, unresolved, start, end: cumulative };
  });
  const funding = rows.filter(a => !incoming.has(a.id)).reduce((sum, a) => sum + a.received, 0);
  const unresolved = rows.reduce((sum, a) => sum + a.unresolved, 0);
  if (funding !== cumulative + unresolved) throw new Error('Consolidation does not reconcile');
  return { rows, funding, spending: cumulative, unresolved };
}
export function financeFreshness(checkedAt: string | null, now = Date.now()) {
  if (!checkedAt) return 'Evidence not checked';
  const date = Date.parse(checkedAt);
  return !Number.isFinite(date) || date > now || now - date > 90 * 86400000 ? 'Stale or invalid evidence — review required' : 'Evidence checked within 90 days';
}
