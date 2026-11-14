import { useId, useState } from "react";

// Experiment definitions only. Never initialize these from visitor or journal data.
export const HOUSEHOLD_PRESETS = [
  ["renter-transit", "Renter using public transit"],
  ["parent-commuter", "Parent with a daily commute"],
  ["older-fixed-budget", "Older adult with a fixed hypothetical budget"],
] as const;
const METRICS = ["Rent", "Travel time", "Flooding", "Taxes", "Services"] as const;

/** Local readiness preview; no model, inference, persistence or remote handoff. */
export function HouseholdImpacts() {
  const id = useId();
  const [preset, setPreset] = useState("");
  const label = HOUSEHOLD_PRESETS.find(([key]) => key === preset)?.[1];
  return <section className="household-impacts" aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`}>Hypothetical household impacts</h4>
    <p id={`${id}-help`} className="muted s">Optional experiment input, not a description of you. Selection stays in this page’s memory and is not sent to the simulation, saved or inferred from your journal, income, address or identity.</p>
    <label htmlFor={`${id}-preset`}>Hypothetical household type</label>
    <select id={`${id}-preset`} aria-describedby={`${id}-help`} value={preset}
      onChange={event => setPreset(HOUSEHOLD_PRESETS.some(([key]) => key === event.target.value) ? event.target.value : "")}>
      <option value="">No household selected — total view</option>
      {HOUSEHOLD_PRESETS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select>
    <button type="button" className="ghost small" disabled={!preset} onClick={() => setPreset("")}>Reset household</button>
    <p role="status">{label ? `Hypothetical selection: ${label}.` : "No household selected. Showing total view."}</p>
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
