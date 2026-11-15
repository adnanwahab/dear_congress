import { useEffect, useRef, type ReactNode } from 'react';
import { motionDuration, STATUS_MOTION, type StatusKind } from './motion';

/** Only changes of meaning animate. Text remains visible after the icon settles. */
export function StateFeedback({ state, children }: { state: StatusKind; children?: ReactNode }) {
  const previous = useRef(state);
  const icon = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const changed = previous.current !== state;
    previous.current = state;
    const duration = motionDuration(STATUS_MOTION[state].duration);
    if (!changed || !duration || !icon.current?.animate) return;
    const animation = icon.current.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration, iterations: 1 });
    void animation.finished?.catch(() => {});
    return () => animation.cancel();
  }, [state]);
  return <span className="state-feedback" data-state={state}>
    <span ref={icon} aria-hidden="true">{STATUS_MOTION[state].icon}</span>{' '}
    {children ?? STATUS_MOTION[state].label}
  </span>;
}
