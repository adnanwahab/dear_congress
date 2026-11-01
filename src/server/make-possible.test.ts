import { describe, expect, test } from "bun:test";
import { NEEDS } from "../engine/catalog";
import type { Proposal } from "../engine/types";
import { voterKey } from "./estimate-idea";
import { closestAnalog, heuristicInterpretation, interpretIdea, recordVariantChoice } from "./make-possible";

const idea = (needId: string, text: string): Proposal => ({
  id: "emergent_1", needId, title: text, mechanism: "To be determined", authority: "Unassigned", jurisdiction: "Unassigned", costB: null,
  changeLevel: 3, reversibility: 0.5, evidence: 0.3, effectiveness: 0.5, keywords: [], metrics: [],
  legalChange: "Needs legal analysis", emergent: true, sourceText: text,
});
const need = (id: string) => NEEDS.find((n) => n.id === id);

describe("reading a citizen idea without an LLM", () => {
  test("a specific idea is matched to the closest program by its words", () => {
    expect(closestAnalog("more buses that come every 10 minutes", "transit").analog?.id).toBe("t_bus");
    expect(closestAnalog("a hotline and mobile crisis teams", "mental_health").analog?.id).toBe("mh_988");
  });

  test("a vague idea is read as a guess, and says so", () => {
    const r = heuristicInterpretation(idea("mental_health", "cool put one everywhere"), need("mental_health"));
    expect(r.intent).toStartWith("Unclear as written");
    expect(r.analogId).toBeDefined();
    expect(r.assumptions.join(" ")).toContain("guess");
    expect(r.provider).toBe("heuristic");
  });

  test("never models an idea on a rights-blocked program", () => {
    for (const text of ["long-time residents first", "residency requirement for newcomers"]) {
      expect(closestAnalog(text, "housing").analog?.id).not.toBe("h_residency");
    }
  });
});

describe("reading a citizen idea with an LLM", () => {
  const good = { intent: "Wants mobile crisis teams everywhere.", title: "Expand mobile crisis teams", implementation: "Fund 25 teams in underserved counties.", assumptions: ["25 teams", "8 staff per team"], analogId: "mh_988" };

  test("uses the model's reading", async () => {
    const r = await interpretIdea(idea("mental_health", "cool put one everywhere"), need("mental_health"), async () => ({ provider: "claude", json: good }));
    expect(r).toMatchObject({ ...good, provider: "claude" });
  });

  test("an analog outside this need's programs falls back to the keyword match", async () => {
    const r = await interpretIdea(idea("transit", "more buses"), need("transit"), async () => ({ provider: "openai", json: { ...good, analogId: "h_residency" } }));
    expect(r.analogId).toBe("t_bus");
  });

  test("no provider, an error or an incomplete answer → offline reading", async () => {
    const p = idea("transit", "more buses");
    for (const complete of [async () => null, async () => { throw new Error("down"); }, async () => ({ provider: "gemini", json: { title: "x" } })]) {
      expect((await interpretIdea(p, need("transit"), complete)).provider).toBe("heuristic");
    }
  });
});

describe("choosing a version", () => {
  test("validates, keeps one pick per voter, stores only a hash", () => {
    const p = idea("transit", "more buses");
    expect("error" in recordVariantChoice(p, "v1", { variant: "huge" })).toBe(true);
    expect("error" in recordVariantChoice({ ...p, emergent: undefined }, "v1", { variant: "pilot" })).toBe(true);
    recordVariantChoice(p, "voter-secret", { variant: "full" });
    recordVariantChoice(p, "voter-secret", { variant: "pilot" });
    recordVariantChoice(p, "other", { variant: "grant" });
    expect(p.variantChoices).toHaveLength(2);
    expect(p.variantChoices!.find((c) => c.voterKey === voterKey("voter-secret"))?.variant).toBe("pilot");
    expect(JSON.stringify(p)).not.toContain("voter-secret");
  });
});
