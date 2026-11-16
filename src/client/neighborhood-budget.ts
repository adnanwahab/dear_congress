/** Fictional teaching fixture; never a civic ballot or an input to synthesis. */
export const DEMO_BUDGET = 100;
export const PROJECTS = [
  { id: 'shade', name: 'Shade trees', cost: 20, radius: 1, benefits: 'People walking and waiting outdoors' },
  { id: 'play', name: 'Play space', cost: 40, radius: 1, benefits: 'Children and caregivers' },
  { id: 'hub', name: 'Community hub', cost: 60, radius: 2, benefits: 'Neighbors seeking shared activities and services' },
] as const;
export type ProjectId = typeof PROJECTS[number]['id'];
export type Allocation = { block: number; project: ProjectId };
export const BLOCKS = Array.from({ length: 9 }, (_, i) => `${'ABC'[Math.floor(i / 3)]}${i % 3 + 1}`);
export function projectById(id: string) { return PROJECTS.find(p => p.id === id); }
export function spent(allocations: Allocation[]) { return allocations.reduce((sum, a) => sum + projectById(a.project)!.cost, 0); }
export function place(allocations: Allocation[], block: number, project: string): { allocations: Allocation[]; message: string } {
  const item = projectById(project);
  if (!item || !Number.isInteger(block) || block < 0 || block >= BLOCKS.length) return { allocations, message: 'Placement failed: choose a listed project and block.' };
  const next = [...allocations.filter(a => a.block !== block), { block, project: item.id }];
  if (spent(next) > DEMO_BUDGET) return { allocations, message: 'Placement failed: insufficient demo credits. Remove a project or choose a cheaper one.' };
  return { allocations: next, message: `${item.name} placed at ${BLOCKS[block]}. ${DEMO_BUDGET - spent(next)} demo credits remaining.` };
}
export function coveredBlocks(allocations: Allocation[]) {
  return BLOCKS.map((_, block) => block).filter(block => allocations.some(a =>
    Math.abs(Math.floor(block / 3) - Math.floor(a.block / 3)) + Math.abs(block % 3 - a.block % 3) <= projectById(a.project)!.radius));
}
