import { runViewTransition } from './motion';
import type { DemoPayload } from '../engine/demo';

/** Encode all code points so punctuation, Unicode and escape-like IDs cannot collide. */
export const proposalTitleName = (id: string) =>
  `proposal-title-${Array.from(id, c => c.codePointAt(0)!.toString(16)).join('-') || 'empty'}`;

export function updateProposal(update: () => void) {
  // Shared helper: typed transition, flushes the update, instant when motion is off.
  void runViewTransition(update, 'proposal-change');
}

// A same-tab snapshot lets the incoming document paint the shared title before
// its asynchronous refresh. Never use this snapshot as vote or merge authority.
const SNAPSHOT = 'civic_demo_motion_snapshot_v1';
export function readProposalSnapshot(): DemoPayload | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SNAPSHOT) ?? 'null');
    if (value && Array.isArray(value.items) && value.items.every((i: any) =>
      i && typeof i.id === 'string' && typeof i.title === 'string' && Array.isArray(i.sponsors) &&
      ['summary', 'currentText', 'proposedText', 'source', 'sourceUrl', 'topic', 'jurisdiction'].every(key => typeof i[key] === 'string') &&
      ['support', 'oppose', 'unsure'].every(key => typeof i[key] === 'number')) &&
      value.votes && typeof value.closesAt === 'string') return value;
  } catch {}
  return null;
}
export function saveProposalSnapshot(value: DemoPayload) {
  try { sessionStorage.setItem(SNAPSHOT, JSON.stringify(value)); } catch {}
}
