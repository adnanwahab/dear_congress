export type PublishDraftKind = "journal" | "answer";

export function toPublishDraftKind(value: unknown): PublishDraftKind | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "journal" || v === "answer") return v;
  return null;
}

export function resolvePublishDraftKind(params: {
  kind: unknown;
  needId: unknown;
  defaultKind: unknown;
}): PublishDraftKind {
  const explicit = toPublishDraftKind(params.kind);
  if (explicit) return explicit;

  if (typeof params.needId === "string" && params.needId.trim()) return "answer";

  const fallback = toPublishDraftKind(params.defaultKind);
  return fallback ?? "journal";
}

export function journalClientSchema(params: {
  defaultKind: unknown;
  needs: { id: string; label: string }[];
}) {
  const normalizedDefault = resolvePublishDraftKind({
    kind: params.defaultKind,
    needId: null,
    defaultKind: "journal",
  });

  return {
    version: 2,
    endpoints: {
      publish_draft: "/api/publish_draft",
      publish_labels: "/api/publish_labels",
    },
    publishDraft: {
      defaultKind: normalizedDefault,
      kinds: ["journal", "answer"] as PublishDraftKind[],
      answerRequiresNeedOrDetectableNeed: true,
    },
    needs: params.needs,
  };
}
