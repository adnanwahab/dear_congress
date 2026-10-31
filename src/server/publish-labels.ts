import type { DB, JournalEntry } from "../engine/types";

export interface NormalizeNeedIdsResult {
  submitted: string[];
  valid: string[];
  ignored: string[];
}

interface PublishLabelsDeps {
  db: DB;
  save: () => Promise<unknown>;
  normalizeNeedIds: (value: unknown) => NormalizeNeedIdsResult;
  logPublishEvent: (event: string, payload: Record<string, unknown>) => void;
  publishCorsHeaders: (req: Request) => Record<string, string>;
}

function withPublishCors(req: Request, res: Response, publishCorsHeaders: (req: Request) => Record<string, string>) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(publishCorsHeaders(req))) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function publishBad(
  req: Request,
  msg: string,
  publishCorsHeaders: (req: Request) => Record<string, string>,
  status = 400,
) {
  return withPublishCors(req, Response.json({ error: msg }, { status }), publishCorsHeaders);
}

export function publishLabelsOptions(req: Request, deps: Pick<PublishLabelsDeps, "logPublishEvent" | "publishCorsHeaders">) {
  deps.logPublishEvent("PUBLISH_LABELS_PREFLIGHT", {
    method: req.method,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    requestMethod: req.headers.get("access-control-request-method"),
    requestHeaders: req.headers.get("access-control-request-headers"),
  });
  return new Response(null, { status: 204, headers: deps.publishCorsHeaders(req) });
}

export async function publishLabelsPost(req: Request, deps: PublishLabelsDeps) {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const remote = req.headers.get("fly-client-ip") ?? req.headers.get("x-forwarded-for") ?? null;
  const contentType = req.headers.get("content-type");
  const secFetchMode = req.headers.get("sec-fetch-mode");

  deps.logPublishEvent("PUBLISH_LABELS_HIT", {
    method: req.method,
    origin,
    referer,
    remote,
    contentType,
    secFetchMode,
  });

  let body: { entryId?: string; labels?: string[]; needs?: string[] };
  try {
    body = (await req.json()) as { entryId?: string; labels?: string[]; needs?: string[] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.logPublishEvent("PUBLISH_LABELS_REJECTED", {
      reason: "invalid json body",
      message,
      origin,
      referer,
      remote,
      contentType,
    });
    return publishBad(req, "invalid json body", deps.publishCorsHeaders);
  }

  if (!body.entryId?.trim()) {
    deps.logPublishEvent("PUBLISH_LABELS_REJECTED", {
      reason: "entryId is required",
      origin,
      referer,
      remote,
    });
    return publishBad(req, "entryId is required", deps.publishCorsHeaders);
  }

  const entry = deps.db.entries.find((e) => e.id === body.entryId) as JournalEntry | undefined;
  if (!entry) {
    deps.logPublishEvent("PUBLISH_LABELS_REJECTED", {
      reason: "entry not found",
      entryId: body.entryId,
      origin,
      referer,
      remote,
    });
    return publishBad(req, "entry not found", deps.publishCorsHeaders);
  }

  const labels = deps.normalizeNeedIds(body.labels ?? body.needs);
  if (labels.valid.length === 0) {
    deps.logPublishEvent("PUBLISH_LABELS_REJECTED", {
      reason: "at least one valid label/need id is required",
      entryId: entry.id,
      submittedNeedIds: labels.submitted,
      ignoredNeedIds: labels.ignored,
      origin,
      referer,
      remote,
    });
    return publishBad(req, "at least one valid label/need id is required", deps.publishCorsHeaders);
  }

  entry.extraction.needs = labels.valid.map((id) => entry.extraction.needs.find((n) => n.id === id) ?? { id, confidence: 1 });
  entry.corrected = true;
  await deps.save();

  deps.logPublishEvent("PUBLISH_LABELS_OK", {
    entryId: entry.id,
    acceptedNeedIds: labels.valid,
    ignoredNeedIds: labels.ignored,
    corrected: entry.corrected,
    origin,
    referer,
    remote,
  });

  return withPublishCors(
    req,
    Response.json({ ok: true, entryId: entry.id, acceptedNeedIds: labels.valid, ignoredNeedIds: labels.ignored, entry }),
    deps.publishCorsHeaders,
  );
}
