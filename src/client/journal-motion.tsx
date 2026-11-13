// Same name as NeedRow (need-motion.tsx) so a journal chip morphs into its Needs row across pages.
export { needTransitionName } from './need-motion';
export const needUrl = (id: string, entry?: string) => `/needs?${new URLSearchParams(entry ? { need: id, entry } : { need: id })}`;

/** Replay only the one contribution confirmed in the loaded public state. The
 * accessible value always reports the actual aggregate, never an invented vote. */
export function NeedMentionCount({ count, added }: { count: number; added: boolean }) {
  return <span className={added && count > 0 ? 'need-mention-count' : undefined} aria-label={String(count)}>
    {added && count > 0 && <span className="need-count-before" aria-hidden="true">{count - 1}</span>}
    <span className="need-count-final" aria-hidden="true">{count}</span>
  </span>;
}
