import sample from "../../data/audit-samples/transit-v1.json";
import { canonicalJSON, replaySnapshot } from "./audit-replay";

// Reviewed, wholly fabricated bytes only. No DB/Context input or filesystem path from a request.
const report = replaySnapshot(sample);
const bytes = canonicalJSON(sample) + "\n";
const url = `/api/audit-samples/${report.snapshotId}`;
export function auditSampleResponse(id?: string): Response {
  if (id === undefined) return Response.json({
    schema: "dear-congress-audit-sample-index.v1",
    samples: [{ ...report, url }],
    productionSnapshots: "unavailable; privacy, signatures and daily publication pending",
  }, { headers: { "Cache-Control": "no-store" } });
  if (id !== report.snapshotId) return Response.json({ error: "Unknown audit sample" }, { status: 404 });
  return new Response(bytes, { headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "ETag": `"${report.snapshotId}"`,
    "X-Content-Type-Options": "nosniff",
  } });
}
