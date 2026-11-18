import { expect, test } from "bun:test";
import { Window } from "happy-dom";

test("proposal editor saves to the API, restores after remount and withdraws without publishing", async () => {
  const win = new Window({ url: "http://localhost:8000/votes?bill=HFL-042" });
  const keys = ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Element", "Node", "Event", "MouseEvent"];
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const previousAct = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  for (const key of keys) Object.defineProperty(globalThis, key, {
    configurable: true, value: key === "window" ? win : (win as any)[key],
  });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const previousFetch = globalThis.fetch;
  const { act, useState } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { fireEvent, within } = await import("@testing-library/dom");
  const { CatalogAmendments } = await import("./CatalogAmendments");
  const revision = "a".repeat(64);
  const text = "Specify a clear paid-leave accrual floor covering part-time workers.";
  const records: any[] = [];
  const calls: Array<{ path: string; method: string; body?: any }> = [];
  const now = "2026-11-18T15:00:00.000Z";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method, body });
    if (method === "GET") return Response.json({
      billId: "HFL-042", revision, visibility: "reviewers_only",
      amendments: records.map(item => ({ ...item })),
    });
    if (method === "POST" && path.endsWith("/withdraw")) {
      const id = path.split("/").at(-2);
      const match = records.find(x => x.id === id)!;
      match.status = "withdrawn"; match.text = ""; match.withdrawnAt = now;
      return Response.json({ saved: true, receipt: { id: "withdrawal-receipt", recordedAt: now } });
    }
    if (method === "POST") {
      const row = { id: "saved-amendment", billId: "HFL-042", revision,
        jurisdiction: "federal", status: "pending_review",
        text: body.text, createdAt: now, withdrawnAt: null };
      records.push(row);
      return Response.json({
        saved: true, replayed: false, amendment: row,
        receipt: { id: "submission-receipt", recordedAt: now },
      });
    }
    return Response.json({ error: "Unknown route" }, { status: 404 });
  }) as typeof fetch;

  function Harness() {
    const [draft, setDraft] = useState("");
    return <CatalogAmendments billId="HFL-042" revision={revision}
      text={draft} onTextChange={setDraft} />;
  }
  const host = win.document.createElement("div");
  win.document.body.append(host);
  let root = createRoot(host as unknown as HTMLElement);
  const q = () => within(host);
  try {
    await act(async () => root.render(<Harness />));
    expect(host.textContent).toContain("no saved amendments");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("GET");

    await act(async () => {
      fireEvent.change(q().getByLabelText("Proposed amendment"), { target: { value: text } });
    });
    expect(calls).toHaveLength(1); // Preview and typing are not server writes.
    await act(async () => fireEvent.click(q().getByRole("button", { name: "Preview amendment" })));
    expect(host.textContent).toContain("It has not been submitted.");
    await act(async () => fireEvent.click(q().getByRole("checkbox")));
    await act(async () => fireEvent.click(q().getByRole("button", { name: "Submit proposed amendment" })));

    const posted = calls.filter(c => c.method === "POST");
    expect(posted).toHaveLength(1);
    expect(posted[0]!.body).toMatchObject({
      revision, text, confirmForReview: true,
    });
    expect(posted[0]!.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(host.textContent).toContain("Saved to the amendment database");
    expect(host.textContent).toContain("Pending human review");
    expect(records).toHaveLength(1);

    await act(async () => root.unmount());
    root = createRoot(host as unknown as HTMLElement);
    await act(async () => root.render(<Harness />));
    expect(host.textContent).toContain(text);
    expect(host.textContent).toContain("saved-amendment");

    await act(async () => fireEvent.click(q().getByRole("button", { name: "Withdraw this amendment" })));
    expect(host.textContent).toContain("Amendment withdrawn");
    expect(records[0]!.text).toBe("");
    expect(host.textContent).not.toContain(text);
    expect(calls.filter(c => c.method === "POST")).toHaveLength(2);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = previousFetch;
    keys.forEach((key,index) => {
      const descriptor = previous[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousAct;
    await win.happyDOM.close();
  }
});
