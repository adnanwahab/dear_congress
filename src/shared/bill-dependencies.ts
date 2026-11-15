import type { CatalogBill } from './bill-catalog';

/** Separate from catalog content, official bills, ballots and synthesis inputs. */
export type BillDependency = {
  id: string;
  prerequisite: string;
  dependent: string;
  prerequisiteRevision: string;
  dependentRevision: string;
  kind: 'funding' | 'administering agency' | 'implementation order';
  explanation: string;
  source: { url: string; label: string; reviewedOn: string; reviewBy: string };
};
// No reviewed cross-bill dependencies have been supplied. Category membership is
// editorial organization only and must never become a dependency edge.
export const billDependencies: readonly BillDependency[] = [];
export function dependencyStatus(edge: BillDependency, bills: readonly CatalogBill[], today: string) {
  const from = bills.find(b => b.id === edge.prerequisite);
  const to = bills.find(b => b.id === edge.dependent);
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const validDay = (s: string) => date.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  let accessible = false;
  try { const url = new URL(edge.source.url); accessible = url.protocol === 'https:' && !url.username && !url.password; } catch {}
  if (!from || !to || from.id === to.id || !accessible || !edge.explanation.trim() || !edge.source.label.trim() ||
      !validDay(edge.source.reviewedOn) || !validDay(edge.source.reviewBy) || !validDay(today) ||
      edge.source.reviewedOn > today || edge.source.reviewBy < edge.source.reviewedOn) return 'unavailable';
  if (from.revision !== edge.prerequisiteRevision || to.revision !== edge.dependentRevision || edge.source.reviewBy < today) return 'stale';
  return 'reviewed';
}
