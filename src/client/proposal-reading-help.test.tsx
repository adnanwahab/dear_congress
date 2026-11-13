import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CitizenProposalsApp } from "./CitizenProposals";
import { ProposalReadingHelp } from "./ProposalReadingHelp";

test("reading help closes with Escape from a source link and returns focus without submitting", async () => {
  const dom = new Window({ url: "https://example.test/proposals/fixture" });
  const originalFetch = globalThis.fetch;
  const keys = ["window", "document", "navigator", "HTMLElement", "Node", "IS_REACT_ACT_ENVIRONMENT"];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  for (const key of keys) Object.defineProperty(globalThis, key, {
    configurable: true, value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : key === "window" ? dom : (dom as any)[key],
  });
  const container = dom.document.createElement("div");
  dom.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  let submits = 0;
  try {
    await act(async () => { root.render(<form onSubmit={e => { e.preventDefault(); submits++; }}><ProposalReadingHelp /><textarea defaultValue="Unsent comment" /></form>); });
    const details = container.querySelector("details")!;
    const summary = container.querySelector("summary")!;
    expect(details.open).toBe(false);
    expect(container.querySelectorAll("dt").length).toBe(3);
    expect([...container.querySelectorAll("a")].map(a => a.getAttribute("href"))).toEqual([
      "#cp-source-status", "#cp-advisory-process", "#cp-browser-identity",
    ]);
    details.open = true;
    const link = container.querySelector("a")!;
    link.focus();
    link.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(details.open).toBe(true); // Ordinary navigation never dismisses help.
    await act(async () => { link.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(details.open).toBe(false);
    expect(dom.document.activeElement).toBe(summary);
    expect(container.querySelector("textarea")!.value).toBe("Unsent comment");
    expect(submits).toBe(0);
    expect(container.querySelectorAll("button, input, select").length).toBe(0);

    const requests: { path: string; method: string }[] = [];
    globalThis.fetch = (async (path: string, init?: RequestInit) => {
      requests.push({ path, method: init?.method ?? "GET" });
      return Response.json({ proposal: {
        id: "fixture", title: "Original citizen title", problem: "Original problem",
        proposedChange: "Original change <script>untrusted</script>", jurisdiction: "unsure",
        publishedAt: "2026-11-13T12:00:00Z", counts: { support: 1, oppose: 0, unsure: 0 },
        countTotal: 1, ownVote: "support", comments: [],
      } });
    }) as typeof fetch;
    await act(async () => { root.render(<CitizenProposalsApp />); });
    const integratedHelp = container.querySelector("details")!;
    expect(integratedHelp).not.toBeNull();
    for (const source of integratedHelp.querySelectorAll("a")) {
      const target = container.querySelector(source.getAttribute("href")!)!;
      expect(target).not.toBeNull();
      expect(target.closest("details")).toBeNull();
      expect(target.getAttribute("tabindex")).toBe("-1");
    }
    const selected = container.querySelector('[aria-pressed="true"]')!;
    const original = container.querySelector("article")!;
    const originalText = original.textContent;
    integratedHelp.open = true;
    await act(async () => { integratedHelp.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(container.querySelector('[aria-pressed="true"]')).toBe(selected);
    expect(container.querySelector("article")).toBe(original);
    expect(original.textContent).toBe(originalText);
    expect(original.querySelector("script")).toBeNull();
    expect(requests).toEqual([{ path: "/api/citizen-proposals/fixture", method: "GET" }]);
  } finally {
    globalThis.fetch = originalFetch;
    await act(async () => { root.unmount(); });
    keys.forEach((key, index) => {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
    await dom.happyDOM.close();
  }
});
