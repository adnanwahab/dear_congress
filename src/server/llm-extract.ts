import { extract } from "../engine/engine";
import type { Extraction, NeedDef, Proposal } from "../engine/types";

interface ProposedNeed {
  label: string;
  goal: string;
  metric: string;
  keywords: string[];
  value?: string;
  level?: string;
}

interface LLMExtractionResult {
  provider: "gemini" | "openai" | "claude" | "fallback";
  extraction: Extraction;
  proposedNeed: ProposedNeed | null;
}

function clamp(x: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, x));
}

function jsonObjectFromText(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) return null;

  const raw = candidate.slice(start, end + 1);
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeResult(
  raw: Record<string, unknown> | null,
  proposals: Proposal[],
  needs: NeedDef[],
  fallback: Extraction,
): { extraction: Extraction; proposedNeed: ProposedNeed | null } {
  if (!raw) return { extraction: fallback, proposedNeed: null };

  const needIds = new Set(needs.map((n) => n.id));
  const proposalIds = new Set(proposals.map((p) => p.id));

  const parsedNeeds = Array.isArray(raw.needs)
    ? raw.needs
      .map((n) => {
        if (!n || typeof n !== "object") return null;
        const id = typeof (n as { id?: unknown }).id === "string" ? String((n as { id?: unknown }).id).trim() : "";
        const confidence = Number((n as { confidence?: unknown }).confidence ?? 0);
        if (!id || !needIds.has(id)) return null;
        return { id, confidence: clamp(Number.isFinite(confidence) ? confidence : 0.6) };
      })
      .filter((x): x is { id: string; confidence: number } => Boolean(x))
    : [];

  const importanceRaw = Number(raw.importance);
  const importance = Number.isFinite(importanceRaw) ? clamp(importanceRaw) : fallback.importance;

  const concerns = Array.isArray(raw.concerns)
    ? raw.concerns.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 8)
    : fallback.concerns;

  const constraints = Array.isArray(raw.constraints)
    ? raw.constraints.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 8)
    : fallback.constraints;

  const parsedProposalIds = Array.isArray(raw.proposalIds)
    ? raw.proposalIds.filter((x): x is string => typeof x === "string" && proposalIds.has(x))
    : fallback.proposalIds;

  let proposedNeed: ProposedNeed | null = null;
  if (raw.proposedNeed && typeof raw.proposedNeed === "object") {
    const pn = raw.proposedNeed as Record<string, unknown>;
    const label = typeof pn.label === "string" ? pn.label.trim() : "";
    const goal = typeof pn.goal === "string" ? pn.goal.trim() : "";
    const metric = typeof pn.metric === "string" ? pn.metric.trim() : "";
    const keywords = Array.isArray(pn.keywords)
      ? pn.keywords.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 12)
      : [];

    if (label && goal && metric) {
      proposedNeed = {
        label,
        goal,
        metric,
        keywords,
        value: typeof pn.value === "string" ? pn.value.trim() : undefined,
        level: typeof pn.level === "string" ? pn.level.trim() : undefined,
      };
    }
  }

  return {
    extraction: {
      needs: parsedNeeds,
      importance,
      concerns,
      constraints,
      proposalIds: parsedProposalIds,
    },
    proposedNeed,
  };
}

function promptFor(text: string, needs: NeedDef[], proposals: Proposal[]) {
  const needsMini = needs.map((n) => ({ id: n.id, label: n.label, keywords: n.keywords.slice(0, 16) }));
  const proposalsMini = proposals.map((p) => ({ id: p.id, needId: p.needId, title: p.title, keywords: p.keywords.slice(0, 12) }));

  return [
    "You are a civic text extraction engine.",
    "Return ONLY JSON with this schema:",
    "{",
    '  "needs": [{"id": string, "confidence": number}],',
    '  "importance": number,',
    '  "concerns": string[],',
    '  "constraints": string[],',
    '  "proposalIds": string[],',
    '  "proposedNeed": null | {"label": string, "goal": string, "metric": string, "keywords": string[], "value"?: string, "level"?: string}',
    "}",
    "Rules:",
    "- Choose needs IDs ONLY from the provided catalog.",
    "- confidence and importance are between 0 and 1.",
    "- proposalIds must come only from provided proposals and must be relevant to selected needs.",
    "- If no catalog need fits, set needs to [] and provide proposedNeed.",
    "- If a catalog need fits, proposedNeed must be null.",
    "Needs catalog:",
    JSON.stringify(needsMini),
    "Proposals catalog:",
    JSON.stringify(proposalsMini),
    "Journal text:",
    text,
  ].join("\n");
}

async function callGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("\n").trim();
  return text || null;
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      input: prompt,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json() as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };

  const textFromOutputText = typeof data.output_text === "string" ? data.output_text.trim() : "";
  if (textFromOutputText) return textFromOutputText;

  const chunks = (data.output ?? [])
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text ?? "");

  const text = chunks.join("\n").trim();
  return text || null;
}

async function callClaude(prompt: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude error ${res.status}`);
  const data = await res.json() as { content?: { type?: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
  return text || null;
}

export async function extractWithLLM(
  text: string,
  proposals: Proposal[],
  needs: NeedDef[],
): Promise<LLMExtractionResult> {
  const fallback = extract(text, proposals, needs);
  const prompt = promptFor(text, needs, proposals);

  const providers: Array<{ name: "gemini" | "openai" | "claude"; run: () => Promise<string | null> }> = [
    { name: "gemini", run: () => callGemini(prompt) },
    { name: "openai", run: () => callOpenAI(prompt) },
    { name: "claude", run: () => callClaude(prompt) },
  ];

  for (const provider of providers) {
    try {
      const rawText = await provider.run();
      if (!rawText) continue;
      const rawJson = jsonObjectFromText(rawText);
      const normalized = normalizeResult(rawJson, proposals, needs, fallback);
      return {
        provider: provider.name,
        extraction: normalized.extraction,
        proposedNeed: normalized.proposedNeed,
      };
    } catch {
      // try next provider
    }
  }

  return {
    provider: "fallback",
    extraction: fallback,
    proposedNeed: null,
  };
}
