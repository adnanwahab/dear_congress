import { useEffect, useRef, useState } from 'react';
import type { DemoItem } from '../engine/demo';
import { runViewTransition } from './motion';
import { proposalTitleName } from './proposal-motion';
import { ProposalProvenance } from './ProposalProvenance';

/** The live disclosure is navigation truth; snapshots are disposable decoration. */
export function ProposalPaper({ item, draftUrl }: { item: DemoItem; draftUrl: string }) {
  const [open, setOpen] = useState(false);
  const desired = useRef(false);
  const transition = useRef<ViewTransition | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; transition.current?.skipTransition(); }; }, []);
  function toggle() {
    desired.current = !desired.current;
    transition.current?.skipTransition();
    const commit = () => { if (mounted.current) setOpen(desired.current); };
    void runViewTransition(commit, 'proposal-fold', value => { transition.current = value; }).catch(commit);
  }
  return <details className="proposal-paper" open={open} style={{ viewTransitionName: proposalTitleName(`sample:${item.id}`).replace('proposal-title-', 'proposal-paper-') }}>
    <summary onClick={event => { event.preventDefault(); toggle(); }}>Read proposal document</summary>
    <div className="proposal-paper-body">
      <h4>Current wording · illustrative</h4><p>{item.currentText}</p>
      <h4>Proposed wording · fictional sample</h4><p>{item.proposedText}</p>
      <ProposalProvenance item={item} />
      <a href={draftUrl}>Continue to sample draft →</a>
      <p>Reading this document sends nothing and casts no vote.</p>
    </div>
  </details>;
}
