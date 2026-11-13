import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SyntheticPipeline } from "./synthetic-pipeline";

/** Closed-loop local microbenchmark, deliberately has no endpoint/path/credential input. */
export function benchmark(events = 1000) {
  if (!Number.isSafeInteger(events) || events < 1 || events > 1_000_000) throw new Error("Event count must be 1–1000000");
  const revision = Bun.spawnSync(["git", "rev-parse", "HEAD"], { stdout: "pipe", stderr: "pipe" });
  const changes = Bun.spawnSync(["git", "status", "--porcelain"], { stdout: "pipe", stderr: "pipe" });
  const source = { sha: revision.exitCode === 0 ? revision.stdout.toString().trim() : "unavailable", dirty: changes.exitCode === 0 ? !!changes.stdout.toString().trim() : null };
  const dir = mkdtempSync(join(tmpdir(), "she320-bench-"));
  const p = new SyntheticPipeline(join(dir, "synthetic.sqlite"));
  const scope = { tenant: "synthetic-bench", region: "synthetic-local", subject: "synthetic-subject" };
  const latencies: number[] = []; let duplicates = 0;
  try {
    const generation = p.grant(scope);
    const started = performance.now();
    for (let i = 0; i < events; i++) {
      const event = { key: `event-${i}`, sourceId: `source-${i}`, generation, synthetic: true as const, text: "Rent is expensive and the bus is late." };
      const before = performance.now();
      p.enqueue(scope, event);
      if (i % 20 === 0 && p.enqueue(scope, event).duplicate) duplicates++;
      p.processOne(scope);
      latencies.push(performance.now() - before);
    }
    const elapsedMs = performance.now() - started;
    latencies.sort((a, b) => a - b);
    const snapshot = p.snapshot(scope);
    if (snapshot.states.length !== 1 || snapshot.states[0]?.status !== "processed" || snapshot.states[0].count !== events || snapshot.payloads !== 0) throw new Error("Receipt reconciliation failed");
    const deletionStarted = performance.now(); p.withdraw(scope);
    const deletionMs = performance.now() - deletionStarted;
    if (p.snapshot(scope).aggregates.length || p.snapshot(scope).payloads) throw new Error("Deletion reconciliation failed");
    return {
      schema: 1, source, kind: "local-synthetic-microbenchmark", generator: "fixed-vocabulary-v1", bun: Bun.version,
      platform: process.platform, arch: process.arch, topology: "single-process SQLite WAL FULL; local rules; no replication/network/provider",
      events, duplicates, elapsedMs, completedPerSecond: events / (elapsedMs / 1000),
      enqueueAndProcessMs: { p95: latencies[Math.ceil(events * .95) - 1], p99: latencies[Math.ceil(events * .99) - 1] },
      deletionMs, reconciled: true,
      assumptions: { peakFactor: 10, bytesPerEvent: 2048, fixedMonthlyUSD: 300, variableUSDPerMillion: [1, 10, 100] },
      modeledOnly: [1e6, 1e7, 3e8].map(daily => ({ daily, meanPerSecond: daily / 86400, peakPerSecond: daily / 8640, payloadGBPerDay: daily * 2048 / 1e9, monthlySensitivityUSD: [1, 10, 100].map(v => 300 + 30 * daily / 1e6 * v) })),
      limitation: "Closed-loop microbenchmark; no daily capacity, SLO, vendor cost or production-readiness claim. Not a 24-hour soak.",
    };
  } finally { p.close(); rmSync(dir, { recursive: true, force: true }); }
}
if (import.meta.main) console.log(JSON.stringify(benchmark(Number(process.argv[2] ?? 1000)), null, 2));
