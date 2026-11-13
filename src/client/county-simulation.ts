export const PRIORITIES = ['Affordability', 'Local flexibility', 'Access & delivery', 'Accountability'] as const;
export const INITIAL_PLAN = [28, 22, 32, 18];
export function requirements(id: string): number[] {
  let seed = Number(id) + 17;
  return PRIORITIES.map(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return 40 + seed % 56; });
}
export function countyVote(id: string, plan: number[]) {
  const needs = requirements(id);
  const gaps = needs.map((need, i) => Math.max(0, need - (plan[i] ?? 0)));
  const gap = Math.max(...gaps);
  return { status: gap === 0 ? 'agree' : gap <= 16 ? 'review' : 'object', priority: gaps.indexOf(gap), gap } as const;
}
export function improvePlan(plan: number[], ids: string[]): number[] {
  const targets = [0, 0, 0, 0];
  for (const id of ids) requirements(id).forEach((need, i) => { targets[i] = Math.max(targets[i]!, need); });
  return plan.map((value, i) => Math.min(targets[i]!, value + 9));
}
