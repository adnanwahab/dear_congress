/** Shared identity for every local destination in the bottom navigation. */
export function CivicHeader({ stage }: { stage: string }) {
  return <header className="civic-header civic-shell">
    <div className="header-brand"><a href="/">Civic Synthesis</a><span className="pill">{stage}</span></div>
    <div className="header-meta"><span className="pill warn">SAMPLE DATA</span><span className="pill info">Advisory · not binding</span></div>
  </header>;
}
