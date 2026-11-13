import { useId } from 'react';

/** The design document's idea input and plan/check feedback loop. */
export default function ThreeAppLoop() {
  const id = useId();
  return <figure className="three-app-loop">
    <svg viewBox="0 0 620 530" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <title id={`${id}-title`}>Three apps, one loop</title>
      <desc id={`${id}-description`}>digital-pensieve dreams. Ideas go to Civic Synthesis, which decides through votes, edits, and plan packages. HappyBearLandia checks by simulating the change. The diff comes back to Civic Synthesis.</desc>
      <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#61748b" /></marker></defs>
      <g className="three-app-loop-paths" fill="none" stroke="#61748b" strokeWidth="2.5" markerEnd={`url(#${id}-arrow)`} aria-hidden="true">
        <path d="M310 116 V205" />
        <path d="M450 260 C590 260 590 450 450 450" />
        <path d="M170 450 C30 450 30 260 170 260" />
      </g>
      <path className="three-app-loop-pulse" d="M450 260 C590 260 590 450 450 450 H170 C30 450 30 260 170 260 Z" pathLength="100" fill="none" stroke="#096b64" strokeWidth="5" strokeLinecap="round" strokeDasharray="3 97" aria-hidden="true" />
      <g className="three-app-loop-labels" aria-hidden="true">
        <text x="325" y="166">ideas ↓</text>
        <text x="430" y="346" textAnchor="middle">plan</text><text x="430" y="370" textAnchor="middle">packages ↓</text>
        <text x="187" y="346" textAnchor="middle">↑ diff</text><text x="187" y="370" textAnchor="middle">comes back</text>
      </g>
      <a href="https://digital-pensieve.fly.dev/" target="_blank" rel="noopener noreferrer" aria-label="digital-pensieve dreams (opens in a new tab)">
        <rect x="170" y="20" width="280" height="96" rx="16" />
        <text x="310" y="54" textAnchor="middle" className="three-app-loop-name">digital-pensieve ↗</text>
        <text x="310" y="80" textAnchor="middle">dreams</text>
        <text x="310" y="102" textAnchor="middle" className="three-app-loop-new-tab">opens in a new tab</text>
      </a>
      <a href="/" aria-label="Civic Synthesis decides: votes, edits, plan packages">
        <rect x="170" y="205" width="280" height="110" rx="16" />
        <text x="310" y="238" textAnchor="middle" className="three-app-loop-name">Civic Synthesis</text>
        <text x="310" y="266" textAnchor="middle">decides</text>
        <text x="310" y="294" textAnchor="middle">votes, edits, plan packages</text>
      </a>
      <a href="https://happybearlandia.fly.dev/world" target="_blank" rel="noopener noreferrer" aria-label="HappyBearLandia checks: simulates the change (opens in a new tab)">
        <rect x="170" y="395" width="280" height="110" rx="16" />
        <text x="310" y="426" textAnchor="middle" className="three-app-loop-name">HappyBearLandia ↗</text>
        <text x="310" y="451" textAnchor="middle">checks</text>
        <text x="310" y="475" textAnchor="middle">simulates the change</text>
        <text x="310" y="494" textAnchor="middle" className="three-app-loop-new-tab">opens in a new tab</text>
      </a>
    </svg>
  </figure>;
}
