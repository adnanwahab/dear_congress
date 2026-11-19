import { expect, test } from "bun:test";
import { HELIOS_TRANSFORMERS, reduceHelios, type HeliosAnalysis, type HeliosReading } from "../shared/helios-ensemble";
import { handleHeliosEnsemble, parseHeliosAnalysis, runHeliosEnsemble } from "./helios-ensemble";

const analysis = (stance: HeliosAnalysis["stance"] = "revise"): HeliosAnalysis => ({
  stance, summary: "Review costs and access before changing the policy",
  benefits: ["Improves access"], risks: ["Uncertain costs"], assumptions: ["Local capacity exists"],
  questions: ["What would an independent evaluation show?"], focusAreas: ["cost", "equity"],
});

test("reducer preserves dissent and separates model opinions from civic consensus", () => {
  const readings: HeliosReading[] = [
    { transformer: "muse", status: "completed", model: "test", analysis: analysis("support") },
    { transformer: "grok", status: "completed", model: "test", analysis: analysis("revise") },
    { transformer: "gemini", status: "unconfigured" },
    { transformer: "claude", status: "completed", model: "test", analysis: analysis("revise") },
    { transformer: "openAI", status: "failed", model: "test" },
  ];
  const result = reduceHelios(readings);
  expect(result.total).toBe(5);
  expect(result.completed).toBe(3);
  expect(result.agreement).toBe("divergent");
  expect(result.majorityStance).toBe("revise");
  expect(result.readings).toEqual(readings);
  expect(result.focusAreas.find(x => x.area === "cost")?.transformers).toEqual(["muse", "grok", "claude"]);
  expect(result.disclaimer).toContain("not public consensus");
});
test("zero or one responding model cannot be called aligned", () => {
  expect(reduceHelios([]).agreement).toBe("insufficient");
  expect(reduceHelios([{ transformer: "muse", status: "completed", model: "test", analysis: analysis() }]).agreement).toBe("insufficient");
});
test("malformed model output fails closed", () => {
  expect(() => parseHeliosAnalysis('{"stance":"yes","summary":"no"}')).toThrow();
  expect(() => parseHeliosAnalysis('{"stance":"support"}')).toThrow();
  expect(parseHeliosAnalysis(JSON.stringify(analysis())).focusAreas).toEqual(["cost", "equity"]);
});
test("five configured models run concurrently and reduce in stable order", async () => {
  const sent: string[] = [];
  const fakeFetch = (async (url: string | URL | Request) => {
    const target = String(url);
    sent.push(target);
    const modelText = JSON.stringify(analysis());
    const payload = target.includes("generativelanguage")
      ? { candidates: [{ content: { parts: [{ text: modelText }] } }] }
      : target.includes("anthropic")
        ? { content: [{ type: "text", text: modelText }] }
        : { output: [{ content: [{ type: "output_text", text: modelText }] }] };
    return Response.json(payload);
  }) as unknown as typeof fetch;
  const result = await runHeliosEnsemble("Should a city add more accessible public buses?", {
    env: {
      HELIOS_MUSE_API_KEY: "muse-test", HELIOS_MUSE_MODEL: "test-muse",
      HELIOS_MUSE_RESPONSES_URL: "https://test-muse.example/v1/responses",
      XAI_API_KEY: "xai-test", GEMINI_API_KEY: "gemini-test",
      ANTHROPIC_API_KEY: "claude-test", OPENAI_API_KEY: "openai-test",
    },
    fetchImpl: fakeFetch,
  });
  expect(result.completed).toBe(5);
  expect(result.agreement).toBe("aligned");
  expect(result.readings.map(r => r.transformer)).toEqual([...HELIOS_TRANSFORMERS]);
  expect(sent.length).toBe(5);
  expect(result.mode).toBe("live");
});
test("missing keys and provider errors never silently count as agreement", async () => {
  const fakeFetch = (async () => new Response("upstream unavailable", { status: 503 })) as unknown as typeof fetch;
  const result = await runHeliosEnsemble("Should a city pilot better local transit?", { env: { OPENAI_API_KEY: "x" }, fetchImpl: fakeFetch });
  expect(result.completed).toBe(0);
  expect(result.readings.find(r => r.transformer === "openAI")?.status).toBe("failed");
  expect(result.readings.find(r => r.transformer === "muse")?.status).toBe("unconfigured");
  expect(result.agreement).toBe("insufficient");
});
test("live endpoint defaults off, then requires token and affirmative consent", async () => {
  const url = "https://civic-synthesis.fly.dev/api/helios/ensemble";
  const token = "a-test-token-with-more-than-24-chars";
  const request = (auth: string | null, consent: boolean) => new Request(url, {
    method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer " + auth } : {}) },
    body: JSON.stringify({ question: "Should a city pilot better public transit?", consentToExternalProcessing: consent }),
  });
  const opts = { env: { HELIOS_ENSEMBLE_ENABLED: "1", HELIOS_ENSEMBLE_TOKEN: token } };
  expect((await handleHeliosEnsemble(request(token, true), { env: {} })).status).toBe(503);
  expect((await handleHeliosEnsemble(request(null, true), opts)).status).toBe(401);
  expect((await handleHeliosEnsemble(request("wrong", true), opts)).status).toBe(401);
  expect((await handleHeliosEnsemble(request(token, false), opts)).status).toBe(400);
  const ok = await handleHeliosEnsemble(request(token, true), opts);
  expect(ok.status).toBe(200);
  expect((await ok.json()).completed).toBe(0);
});
