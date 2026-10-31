import { describe, expect, test } from "bun:test";
import { journalClientSchema, resolvePublishDraftKind } from "./src/server/publish-draft";

describe("publish_draft mode resolution", () => {
  test("defaults to journal when kind and needId are omitted", () => {
    const kind = resolvePublishDraftKind({
      kind: undefined,
      needId: undefined,
      defaultKind: "journal",
    });
    expect(kind).toBe("journal");
  });

  test("infers answer mode when needId is provided and kind is omitted", () => {
    const kind = resolvePublishDraftKind({
      kind: undefined,
      needId: "transit",
      defaultKind: "journal",
    });
    expect(kind).toBe("answer");
  });

  test("uses explicit answer mode", () => {
    const kind = resolvePublishDraftKind({
      kind: "answer",
      needId: undefined,
      defaultKind: "journal",
    });
    expect(kind).toBe("answer");
  });

  test("explicit journal mode overrides needId inference", () => {
    const kind = resolvePublishDraftKind({
      kind: "journal",
      needId: "transit",
      defaultKind: "answer",
    });
    expect(kind).toBe("journal");
  });

  test("falls back safely for invalid default", () => {
    const kind = resolvePublishDraftKind({
      kind: undefined,
      needId: undefined,
      defaultKind: "invalid",
    });
    expect(kind).toBe("journal");
  });
});

describe("journal client schema metadata", () => {
  test("returns version 2 schema with publishDraft metadata", () => {
    const schema = journalClientSchema({
      defaultKind: "answer",
      needs: [{ id: "transit", label: "Reliable transit" }],
    });

    expect(schema.version).toBe(2);
    expect(schema.endpoints.publish_draft).toBe("/api/publish_draft");
    expect(schema.endpoints.publish_labels).toBe("/api/publish_labels");

    expect(schema.publishDraft.defaultKind).toBe("answer");
    expect(schema.publishDraft.kinds).toEqual(["journal", "answer"]);
    expect(schema.publishDraft.answerRequiresNeedOrDetectableNeed).toBe(true);

    expect(schema.needs).toEqual([{ id: "transit", label: "Reliable transit" }]);
  });
});
