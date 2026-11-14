import { ThemeSwitch } from './ThemeSwitch';
import { RealityLens } from './RealityLens';
/** Shared identity for every local destination in the bottom navigation. */
export function CivicHeader({ stage, dataLabel }: { stage: string; dataLabel?: string }) {
  return <header className="civic-header civic-shell">
    <div className="header-brand"><a href="/">Civic Synthesis</a><span className="pill">{stage}</span></div>
    <div className="header-meta"><ThemeSwitch />{dataLabel && <span className="pill warn">{dataLabel}</span>}<span className="pill info">Advisory · not binding</span></div>
    <RealityLens />
  </header>;
}
