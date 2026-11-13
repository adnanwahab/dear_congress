import { flushSync } from 'react-dom';
import type { DemoPayload } from '../engine/demo';

/** Encode all code points so punctuation, Unicode and escape-like IDs cannot collide. */
export const proposalTitleName = (id: string) =>
  `proposal-title-${Array.from(id, c => c.codePointAt(0)!.toString(16)).join('-') || 'empty'}`;

export function updateProposal(update: () => void) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      typeof document.startViewTransition !== 'function') { update(); return; }
  const transition = document.startViewTransition(() => flushSync(update));
  // Hidden tabs or interrupted transitions can skip animation without losing the update.
  void transition.ready.catch(() => {});
  void transition.finished.catch(() => {});
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
