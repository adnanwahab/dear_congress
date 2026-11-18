import { createHash } from 'node:crypto';

export interface PreviewClause { clauseId: string; text: string }
export interface PreviewClauseDiff {
  clauseId: string;
  sourcePolicyId: string | null;
  operation: 'add' | 'remove' | 'modify';
  beforeText: string;
  afterText: string;
}
/** HBL canonical JSON: exact strings, sorted object keys, retained array order. */
export function canonicalLegal(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalLegal).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalLegal((value as Record<string, unknown>)[key])}`).join(',')}}`;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  throw new Error('Non-JSON legal content');
}
export const legalHash = (value: unknown) => createHash('sha256').update(canonicalLegal(value), 'utf8').digest('hex');

export function validatePreviewClauses(clauses: readonly PreviewClause[]) {
  if (!Array.isArray(clauses) || clauses.length > 32) throw new Error('Use at most 32 clauses');
  const ids = new Set<string>();
  for (const clause of clauses) {
    if (!clause || typeof clause.clauseId !== 'string' || !clause.clauseId.trim() || clause.clauseId.length > 96 || ids.has(clause.clauseId)) throw new Error('Unique stable clause IDs required');
    if (typeof clause.text !== 'string' || !clause.text.trim() || clause.text.length > 20000) throw new Error('Invalid exact clause text');
    ids.add(clause.clauseId);
  }
}
/** Stable baseline order followed by new IDs in selected-version order. No NLP. */
export function exactClauseDiff(before: readonly PreviewClause[], after: readonly PreviewClause[]): PreviewClauseDiff[] {
  validatePreviewClauses(before); validatePreviewClauses(after);
  const a = new Map(before.map(c => [c.clauseId, c.text]));
  const b = new Map(after.map(c => [c.clauseId, c.text]));
  return [...new Set([...a.keys(), ...b.keys()])].flatMap(clauseId => {
    const beforeText = a.get(clauseId) ?? '', afterText = b.get(clauseId) ?? '';
    return beforeText === afterText ? [] : [{ clauseId, sourcePolicyId: null,
      operation: !a.has(clauseId) ? 'add' as const : !b.has(clauseId) ? 'remove' as const : 'modify' as const, beforeText, afterText }];
  });
}
