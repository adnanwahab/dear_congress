import { PROPOSALS } from "../engine/catalog";
import { hasKeyword, tokens } from "../engine/engine";
import type { IdeaInterpretation, NeedDef, Proposal, VariantId } from "../engine/types";
import { isVariantId } from "../engine/variants";
import { voterKey } from "./estimate-idea";

/*
 * "Make this possible": turn a raw citizen idea ("cool put one everywhere") into a concrete,
 * costed proposal. An LLM reads what the person most likely wants and picks the closest
 * existing program to cost it from; with no LLM configured, the closest program is found by
 * keyword overlap and the reading says plainly that it's a guess.
 */

type Complete = (prompt: string) => Promise<{ provider: string; json: Record<string, unknown> } | null>;

/** Catalog programs an idea for this need can be modeled on. */
export function analogCandidates(needId: string, catalog: Proposal[] = PROPOSALS): Proposal[] {
  return catalog.filter((p) => p.needId === needId && !p.emergent && !p.rightsIssue && p.costB !== null);
}

/** Closest catalog program by keyword and word overlap; the most effective proven one if nothing overlaps. */
export function closestAnalog(text: string, needId: string, catalog: Proposal[] = PROPOSALS): { analog: Proposal | undefined; overlap: number } {
  const options = analogCandidates(needId, catalog);
  if (!options.length) return { analog: undefined, overlap: 0 };
  const t = text.toLowerCase();
  const tk = new Set(tokens(text));
  let best = options[0]!;
  let bestScore = -1;
  for (const p of options) {
    const kw = p.keywords.filter((k) => hasKeyword(t, k)).length;
    const pt = new Set(tokens(`${p.title} ${p.mechanism}`));
    const inter = [...tk].filter((w) => pt.has(w)).length;
    const score = kw + inter * 0.5;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  if (bestScore > 0) return { analog: best, overlap: bestScore };
  const proven = [...options].sort((a, b) => b.effectiveness * b.evidence - a.effectiveness * a.evidence)[0];
  return { analog: proven, overlap: 0 };
}

/** Offline reading of an idea. Says when it's a guess. */
export function heuristicInterpretation(idea: Proposal, need: NeedDef | undefined, catalog: Proposal[] = PROPOSALS, now = new Date()): IdeaInterpretation {
  const text = (idea.sourceText || idea.title).trim();
  const { analog, overlap } = closestAnalog(text, idea.needId, catalog);
  const needLabel = need?.label ?? "this need";
  const vague = tokens(text).filter((w) => w.length >= 4).length < 3 && overlap === 0;

  const intent = vague
    ? `Unclear as written. Read as a call for more of what already works on ${needLabel.toLowerCase()}${need?.goal ? `, toward the goal: ${need.goal}` : ""}.`
    : `Make progress on ${needLabel.toLowerCase()} by: ${text}`;
  const title = vague
    ? (analog ? `Expand ${analog.title.charAt(0).toLowerCase()}${analog.title.slice(1)}` : `More support for ${needLabel.toLowerCase()}`)
    : text.length > 90 ? `${text.slice(0, 87)}…` : text;
  const implementation = analog
    ? `Modeled on ${analog.title}: ${analog.mechanism}, run by ${analog.authority}.`
    : `A new ${needLabel.toLowerCase()} program; who runs it still needs to be decided.`;
  const assumptions = [
    ...(analog ? [`Same scale and staffing as ${analog.title}`] : ["Same scale as a typical small program"]),
    "Untested as described, so evidence is scored low until it's piloted or reviewed",
    ...(vague ? ["The idea was vague, so this reading is a guess; anyone can suggest a clearer version under Vote"] : []),
  ];
  return { intent, title, implementation, assumptions, ...(analog ? { analogId: analog.id } : {}), provider: "heuristic", createdAt: now.toISOString() };
}

function promptFor(idea: Proposal, need: NeedDef | undefined, catalog: Proposal[]) {
  const programs = analogCandidates(idea.needId, catalog).map((p) => ({ id: p.id, title: p.title, mechanism: p.mechanism, authority: p.authority, jurisdiction: p.jurisdiction, costB: p.costB }));
  return [
    "You turn a citizen's raw policy idea into a concrete, fundable proposal for a civic planning tool.",
    "The idea may be vague or jokey. Read it charitably in the context of the need it was submitted under.",
    "Return ONLY JSON with this schema:",
    '{ "intent": string, "title": string, "implementation": string, "assumptions": string[], "analogId": string | null }',
    "Rules:",
    "- intent: one plain sentence on what the person most likely wants. If it's ambiguous, say so briefly.",
    "- title: a short plan-item title (under 80 characters).",
    "- implementation: one or two sentences on a concrete way to do it: who runs it, where, at what scale.",
    "- assumptions: 2 to 4 short strings that the cost depends on (staffing, scale, coverage).",
    "- analogId: the id of the existing program below that is closest in scale and mechanism (it is used to estimate cost), or null if none is close.",
    "- Never propose anything that discriminates by residency, race, religion or other protected traits.",
    `Need: ${JSON.stringify({ label: need?.label, goal: need?.goal, level: need?.level })}`,
    `Existing programs for this need: ${JSON.stringify(programs)}`,
    `Citizen idea: ${JSON.stringify(idea.sourceText || idea.title)}`,
  ].join("\n");
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Read an idea with an LLM if one is configured, else the offline heuristic. */
export async function interpretIdea(idea: Proposal, need: NeedDef | undefined, complete: Complete, catalog: Proposal[] = PROPOSALS, now = new Date()): Promise<IdeaInterpretation> {
  const fallback = heuristicInterpretation(idea, need, catalog, now);
  let out: Awaited<ReturnType<Complete>> = null;
  try {
    out = await complete(promptFor(idea, need, catalog));
  } catch {
    out = null;
  }
  if (!out) return fallback;
  const j = out.json;
  const intent = str(j.intent, 300);
  const title = str(j.title, 90);
  const implementation = str(j.implementation, 400);
  if (!intent || !title || !implementation) return fallback;
  const assumptions = Array.isArray(j.assumptions) ? j.assumptions.map((a) => str(a, 160)).filter(Boolean).slice(0, 4) : [];
  const validIds = new Set(analogCandidates(idea.needId, catalog).map((p) => p.id));
  const analogId = typeof j.analogId === "string" && validIds.has(j.analogId) ? j.analogId : fallback.analogId;
  return { intent, title, implementation, assumptions, ...(analogId ? { analogId } : {}), provider: out.provider, createdAt: now.toISOString() };
}

/** Record which version of a citizen idea one voter wants in the plan (their earlier pick is replaced). */
export function recordVariantChoice(idea: Proposal, voterId: string, body: Record<string, unknown>, now = new Date()): { ok: true; variant: VariantId } | { error: string } {
  if (!idea.emergent) return { error: "only citizen ideas have versions to choose from" };
  if (!isVariantId(body.variant)) return { error: "variant must be one of: full, targeted, phased, grant, pilot" };
  const key = voterKey(voterId);
  idea.variantChoices = [...(idea.variantChoices ?? []).filter((c) => c.voterKey !== key), { voterKey: key, variant: body.variant, createdAt: now.toISOString() }];
  return { ok: true, variant: body.variant };
}
