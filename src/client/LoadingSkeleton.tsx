import type { Stage } from '../shared/civic-stages';
import './loading-skeleton.css';

export function Skeleton({ kind = 'card' }: { kind?: 'card' | 'vote' | 'list' | 'line' }) {
  return <span className={`skeleton skeleton-${kind}`} role="status" aria-label="Loading content" aria-busy="true"><span aria-hidden="true">{Array.from({ length: kind === 'line' ? 1 : kind === 'vote' ? 7 : 4 }, (_, i) => <span key={i} />)}</span></span>;
}

export function WorkflowSkeleton({ stage }: { stage: Stage }) {
  const grid = stage === 'published' ? 'workflow-source-grid' : stage === 'feed' ? 'workflow-feed-layout' : stage === 'sponsors' ? 'workflow-board' : stage === 'outcomes' ? 'workflow-outcome-list' : 'workflow-two';
  const count = stage === 'sponsors' ? 5 : stage === 'published' || stage === 'outcomes' ? 3 : 2;
  return <div className={`${grid} workflow-loading`} data-skeleton-stage={stage}>{Array.from({ length: count }, (_, i) => <section className="panel" key={i}><Skeleton kind={stage === 'votes' && i === 0 ? 'vote' : stage === 'feed' && i === 0 ? 'list' : 'card'} /></section>)}</div>;
}

// Simplified silhouette in the same 1000 × 750 projection as the county atlas.
export function NationalOutline() {
  return <svg className="national-outline" viewBox="0 0 1000 750" aria-hidden="true"><path pathLength="1" d="M120 90 L225 110 310 120 415 120 450 135 500 130 550 145 585 135 615 155 650 145 670 165 700 150 730 160 760 140 790 130 810 95 835 80 850 115 835 150 855 165 840 195 815 205 800 235 775 250 760 285 745 310 725 340 710 365 690 400 675 435 680 470 665 480 640 430 615 420 585 425 550 410 525 425 500 415 480 440 465 480 440 465 420 430 385 425 350 400 315 390 285 375 255 360 225 335 205 300 185 275 170 245 145 225 140 190 125 155 Z M60 610 L100 560 155 570 190 600 170 630 200 650 155 665 125 640 80 670 45 655 Z M290 650 l15 10 m15 10 l15 5 m20 10 l20 15" /></svg>;
}

export function PageSkeleton({ path }: { path: string }) {
  const stage = (path === '/vote' ? 'votes' : path.slice(1)) as Stage;
  return <div className={`civic-shell ${path === '/map' ? 'county-shell' : ''}`}><header className="civic-header"><div className="header-brand"><a href="/">Civic Synthesis</a></div></header><main id="main-content" tabIndex={-1} className="civic-main"><div className="skeleton-heading"><h1>Loading page</h1><Skeleton /></div>{path === '/map' ? <><div className="county-metrics"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div><div className="county-workspace"><section className="county-atlas"><NationalOutline /></section><aside className="county-plan"><Skeleton kind="vote" /></aside></div></> : ['published','feed','votes','draft','sponsors','outcomes'].includes(stage) ? <WorkflowSkeleton stage={stage} /> : <div className={path.startsWith('/journal') ? 'journal-grid' : 'workflow-two'}><section className="panel"><Skeleton kind="list" /></section><section className="panel"><Skeleton kind="vote" /></section></div>}</main></div>;
}
