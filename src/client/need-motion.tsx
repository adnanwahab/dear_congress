import { useLayoutEffect, useRef } from 'react';
import type { NeedDef, NeedDemand } from '../engine/types';
import { usePlanRowMotion } from './plan-motion';

export type NeedMode = 'real' | 'simulated' | 'both';
export const needTransitionName = (id: string) => `need-${Array.from(id, c => c.codePointAt(0)!.toString(16)).join('-')}`;
export function rankedNeeds(needs: NeedDef[], demand: Record<string, NeedDemand>) {
  return [...needs].sort((a, b) => demand[b.id]!.demand - demand[a.id]!.demand);
}
export function needMoves(before: NeedDef[], after: NeedDef[]) {
  const ranks = new Map(before.map((n, i) => [n.id, i]));
  return new Map(after.map((n, i) => [n.id, (ranks.get(n.id) ?? i) - i]));
}
const scale = (value: number) => Math.max(0, Math.min(1, value));
export function NeedRow({ need, demand, rank, move, selected, mode, onSelect }: {
  need: NeedDef; demand: NeedDemand; rank: number; move: number;
  selected: boolean; mode: NeedMode; onSelect: () => void;
}) {
  const ref = usePlanRowMotion(mode);
  const lastMode = useRef(mode);
  useLayoutEffect(() => {
    if (lastMode.current !== mode && selected) ref.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    lastMode.current = mode;
  }, [mode, selected]);
  const name = needTransitionName(need.id);
  const movement = move ? `${move > 0 ? '↑' : '↓'}${Math.abs(move)}` : '';
  return <li ref={ref} className={selected ? 'on' : ''} style={{ viewTransitionName: name }}>
    <style>{`::view-transition-group(${name}), ::view-transition-group(${name}-bar) { animation-duration: 700ms; animation-timing-function: ease-in-out; }
      ::view-transition-old(${name}-bar) { animation: none; opacity: 0; }
      ::view-transition-new(${name}-bar) { animation: none; height: 100%; }`}</style>
    <button onClick={onSelect} aria-pressed={selected}>
      <div className="need-top"><b>#{rank} {need.label}</b><span className="num-s">{Math.round(demand.demand * 100)}</span></div>
      <div className="bar"><div className="fill accent need-fill" style={{ transform: `scaleX(${scale(demand.demand)})`, viewTransitionName: `${name}-bar` }} /></div>
      <small>{movement && <span key={mode} className="need-movement" aria-label={`Moved ${move > 0 ? 'up' : 'down'} ${Math.abs(move)} places`}>{movement} · </span>}{demand.journalCount} journal mention{demand.journalCount === 1 ? '' : 's'} · {demand.avgPoints} avg priority pts</small>
    </button>
  </li>;
}
