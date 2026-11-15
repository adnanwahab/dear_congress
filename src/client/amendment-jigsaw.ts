/** Entirely fictional teaching fixtures, independent of proposal and ballot identities. */
export const provisionGroups = [
  { id: 'scope', title: 'Scope', why: 'Scope defines where the program operates.', pieces: ['Create a reading-room pilot in the fictional town of Lantern Bay.', 'Create a reading-room pilot across the fictional Lantern Isles region.'] },
  { id: 'eligibility', title: 'Eligibility', why: 'Eligibility should fit the geographic scope.', pieces: ['All Lantern Bay residents may use the pilot.', 'All Lantern Isles residents may use the pilot.'] },
  { id: 'authority', title: 'Authority', why: 'The implementing body needs authority covering the chosen area in this invented scenario.', pieces: ['The Lantern Bay Library Office administers the town pilot only.', 'The Lantern Isles Library Office administers town or regional pilots.'] },
  { id: 'funding', title: 'Funding', why: 'Funding describes resources and when they become available.', pieces: ['Allocate 100 fictional credits, available from day 30.', 'Allocate 100 fictional credits, available from day 90.'] },
  { id: 'date', title: 'Effective date', why: 'The start date should not precede the resources the clause requires.', pieces: ['The funded pilot begins on day 30.', 'The funded pilot begins on day 90.'] },
] as const;
export type Assembly = Partial<Record<typeof provisionGroups[number]['id'], number>>;
export function explainAssembly(assembly: Assembly) {
  const missing = provisionGroups.filter(g => assembly[g.id] !== 0 && assembly[g.id] !== 1);
  const conflicts: string[] = [];
  if (assembly.scope != null && assembly.eligibility != null && assembly.scope !== assembly.eligibility) conflicts.push('Scope and eligibility cover different areas. Match the resident group to the pilot area.');
  if (assembly.scope === 1 && assembly.authority === 0) conflicts.push('The town office has no regional authority in this fictional scenario. Choose the regional office or a town scope.');
  if (assembly.funding === 1 && assembly.date === 0) conflicts.push('Day 30 comes before funding is available on day 90. Start later or use the earlier funding piece.');
  return { missing, conflicts, complete: !missing.length && !conflicts.length };
}
