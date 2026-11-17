import type { Weights } from '../engine/types';

/** Deliberate allowlist: never snapshot AppState, posts, ballots or server results. */
export type SandboxSnapshot = Readonly<{ weights: Readonly<Weights>; lambda: number; budget: number; packageId: string }>;
export type HistoryNode = Readonly<{ id: number; parent: number | null; label: string; snapshot: SandboxSnapshot }>;
export type SandboxHistory = Readonly<{ current: number; nodes: readonly HistoryNode[] }>;
function snapshot(value: SandboxSnapshot): SandboxSnapshot {
  return Object.freeze({ weights: Object.freeze({ ...value.weights }), lambda: value.lambda, budget: value.budget, packageId: value.packageId });
}
export function createSandboxHistory(value: SandboxSnapshot): SandboxHistory {
  return Object.freeze({ current: 0, nodes: Object.freeze([Object.freeze({ id: 0, parent: null, label: 'Initial settings', snapshot: snapshot(value) })]) });
}
export function recordSandbox(history: SandboxHistory, value: SandboxSnapshot, label: string): SandboxHistory {
  const saved = snapshot(value);
  const current = history.nodes[history.current]!;
  if (JSON.stringify(current.snapshot) === JSON.stringify(saved)) return history;
  const id = history.nodes.length;
  return Object.freeze({ current: id, nodes: Object.freeze([...history.nodes, Object.freeze({ id, parent: history.current, label, snapshot: saved })]) });
}
export function restoreSandbox(history: SandboxHistory, id: number): SandboxHistory {
  return history.nodes[id] ? Object.freeze({ ...history, current: id }) : history;
}
