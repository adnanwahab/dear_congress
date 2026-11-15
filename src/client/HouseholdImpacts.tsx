import { useId, useState } from "react";
import { useLocalUndo } from "./LocalUndo";

// Experiment definitions only. Never initialize these from visitor or journal data.
export const HOUSEHOLD_PRESETS = [
  ["renter-transit", "Renter using public transit"],
  ["parent-commuter", "Parent with a daily commute"],
  ["older-fixed-budget", "Older adult with a fixed hypothetical budget"],
  ["caregiver", "Caregiver coordinating multiple trips"],
] as const;
// Authored synthetic scenarios, not empirical coefficients or population groups.
export const STAKEHOLDER_LENSES = {
  "renter-transit": {
    assumptions: "One adult rents, owns no car and makes 10 transit trips per week; rent is $1,000/month in this invented scenario.",
    metrics: "Monthly rent (USD); door-to-door travel (minutes/trip); missed connections (trips/week).",
    extrapolation: "If a proposal improves service on the routes and hours used, waiting could fall. If housing costs rise nearby, rent could offset a travel benefit.",
    narrative: "A shorter wait could leave more time at home, while a rent increase could strain the same budget.",
  },
  "parent-commuter": {
    assumptions: "One adult coordinates a school drop-off and five work round trips per week by car; pickup time is fixed.",
    metrics: "Travel time (minutes/day); transport cost (USD/month); late pickups (days/month).",
    extrapolation: "If a proposal reduces peak travel time, pickup may become easier. Construction or a route change could instead lengthen the linked journey.",
    narrative: "A faster work trip may help little when the school leg still makes pickup late.",
  },
  "older-fixed-budget": {
    assumptions: "One adult has a fixed invented budget of $1,800/month, two essential appointments per month and no assumed eligibility for assistance.",
    metrics: "Essential expenses and taxes (USD/month, separately); accessible appointments reached (visits/month).",
    extrapolation: "If a proposal improves accessible services, appointment access could improve. New fees or taxes could reduce remaining funds; eligibility and actual incidence are unknown.",
    narrative: "A service closer to home could help, but an inaccessible entrance could leave that benefit out of reach.",
  },
  caregiver: {
    assumptions: "One adult makes six care-related trips per week with another person; each trip requires step-free access and a 30-minute arrival window.",
    metrics: "Step-free trips completed (trips/week); care travel (minutes/week); care costs (USD/month).",
    extrapolation: "If a proposal improves step-free routes at the needed times, more trips may be feasible. A faster route without accessible connections may offer no usable time saving.",
    narrative: "Reliable connections could ease coordinating care, while a missed transfer could disrupt the whole day.",
  },
} satisfies Record<typeof HOUSEHOLD_PRESETS[number][0], { assumptions: string; metrics: string; extrapolation: string; narrative: string }>;
const METRICS = ["Rent", "Travel time", "Flooding", "Taxes", "Services"] as const;

/** Local readiness preview; no model, inference, persistence or remote handoff. */
export function HouseholdImpacts() {
  const id = useId();
  const [preset, setPreset] = useState("");
  const undo = useLocalUndo();
  function change(next: string) {
    if (next === preset) return;
    const previous = preset;
    setPreset(next);
    undo.record(`household preset: ${HOUSEHOLD_PRESETS.find(([key]) => key === previous)?.[1] ?? 'total view'}`, () => setPreset(previous));
  }
  const label = HOUSEHOLD_PRESETS.find(([key]) => key === preset)?.[1];
  const lens = STAKEHOLDER_LENSES[preset as keyof typeof STAKEHOLDER_LENSES];
  return <section className="household-impacts" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>Hypothetical household impacts</h4>
    <p id={`${id}-help`} className="muted s">Optional experiment input, not a description of you. Selection stays in this page’s memory and is not sent to the simulation, saved or inferred from your journal, income, address or identity.</p>
    <label htmlFor={`${id}-preset`}>Hypothetical household type</label>
    <select id={`${id}-preset`} aria-describedby={`${id}-help`} value={preset}
      onChange={event => change(HOUSEHOLD_PRESETS.some(([key]) => key === event.target.value) ? event.target.value : "")}>
      <option value="">No household selected — total view</option>
      {HOUSEHOLD_PRESETS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select>
    <button type="button" className="ghost small" disabled={!preset} onClick={() => change("")}>Reset household</button>
    <p role="status">{label ? `Hypothetical selection: ${label}.` : "No household selected. Showing total view."}</p>
    {undo.control}
    {lens && <article className="stakeholder-lens" aria-labelledby={`${id}-lens`}>
      <h5 id={`${id}-lens`}>Synthetic stakeholder lens: {label}</h5>
      <p><strong>Assumptions — illustrative:</strong> {lens.assumptions} These are authored examples, not measured households or population weights.</p>
      <p><strong>Metrics to examine:</strong> {lens.metrics} Compare the same household with and without each proposal over the same period.</p>
      <p><strong>Direct evidence:</strong> Unavailable for this household. The proposal descriptions and evidence below retain their own sources; they do not establish household effects.</p>
      <p><strong>Extrapolation — conditional, unvalidated:</strong> {lens.extrapolation} This reasoning is not a calculated result for the selected package.</p>
      <p><strong>Illustrative narrative — fictional:</strong> {lens.narrative} No resident testimony is represented.</p>
      <p><strong>Uncertainty:</strong> Direction, magnitude, timing, eligibility and distribution of actual effects are unknown. No calibrated interval is available; missing effects do not mean zero.</p>
      <p className="muted s">Local scenario definitions: SHE-456, version 1. Reading or selecting a lens is not a vote or verified civic participation. No demographic identity is assigned to you.</p>
    </article>}
    <div className="household-table" role="region" aria-label="Household impact availability" tabIndex={0}>
      <table>
        <caption>Policy impact availability — illustrative simulation, not a forecast or official advice</caption>
        <thead><tr><th scope="col">Metric</th><th scope="col">Total average</th>{label && <th scope="col">{label}</th>}</tr></thead>
        <tbody>{METRICS.map(metric => <tr key={metric}>
          <th scope="row">{metric}</th><td>Unavailable</td>{label && <td>Unavailable</td>}
        </tr>)}</tbody>
      </table>
    </div>
    <p className="muted s">No validated package-to-household response model is connected here. Effects, better/worse/unchanged counts, uncertainty intervals and simulated cohort sizes are unavailable; no runs were performed. Missing effects do not mean zero impact.</p>
    <p className="muted s">Preset assumptions describe housing, travel or budget scenarios only; they assign no population weights. Aggregate historical conditions, illustrative policy costs and synthetic voter preferences cannot establish household effects. External world links do not carry this selection.</p>
  </section>;
}
