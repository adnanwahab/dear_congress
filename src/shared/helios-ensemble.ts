/** Advisory model opinions, never citizen votes or merge authority. */
export const HELIOS_TRANSFORMERS = ["muse", "grok", "gemini", "claude", "openAI"] as const;
export type HeliosTransformer = typeof HELIOS_TRANSFORMERS[number];
export const HELIOS_STANCES = ["support", "revise", "oppose", "uncertain"] as const;
export type HeliosStance = typeof HELIOS_STANCES[number];
export const HELIOS_LENSES = ["rights", "equity", "cost", "implementation", "evidence", "long_term"] as const;
export type HeliosLens = typeof HELIOS_LENSES[number];

export interface HeliosAnalysis {
  stance: HeliosStance;
  summary: string;
  benefits: string[];
  risks: string[];
  assumptions: string[];
  questions: string[];
  focusAreas: HeliosLens[];
}
export type HeliosReading =
  | { transformer: HeliosTransformer; status: "completed"; model: string; analysis: HeliosAnalysis }
  | { transformer: HeliosTransformer; status: "unconfigured" | "failed"; model?: string };

export interface HeliosSynthesis {
  readings: HeliosReading[];
  completed: number;
  total: number;
  agreement: "aligned" | "divergent" | "insufficient";
  majorityStance: HeliosStance | null;
  stanceCounts: Record<HeliosStance, number>;
  focusAreas: { area: HeliosLens; transformers: HeliosTransformer[] }[];
  disclaimer: string;
}

/** Deterministic reduction. Does not infer agreement beyond matching stances/tags. */
export function reduceHelios(readings: readonly HeliosReading[]): HeliosSynthesis {
  const completed = readings.filter((reading): reading is Extract<HeliosReading, { status: "completed" }> => reading.status === "completed");
  const stanceCounts: Record<HeliosStance, number> = { support: 0, revise: 0, oppose: 0, uncertain: 0 };
  for (const reading of completed) stanceCounts[reading.analysis.stance]++;
  const majorityStance = HELIOS_STANCES.find(stance => stanceCounts[stance] > completed.length / 2) ?? null;
  const agreement = completed.length < 2
    ? "insufficient"
    : HELIOS_STANCES.some(stance => stanceCounts[stance] === completed.length) ? "aligned" : "divergent";
  return {
    readings: [...readings],
    completed: completed.length,
    total: readings.length,
    agreement,
    majorityStance,
    stanceCounts,
    focusAreas: HELIOS_LENSES.map(area => ({
      area,
      transformers: completed.filter(reading => reading.analysis.focusAreas.includes(area)).map(reading => reading.transformer),
    })).filter(item => item.transformers.length > 0),
    disclaimer: "Model agreement is not public consensus, a vote, verified evidence, or legal authority. Review each response and unresolved objection before any human decision.",
  };
}
