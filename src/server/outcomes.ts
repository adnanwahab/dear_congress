import type { PackageResult, SynthesisOutcomes } from "../engine/types";

export type OutcomesMode = "off" | "shadow" | "on";

export interface OutcomeSource {
  name: string;
  url: string;
  caveat?: string;
}

export interface OutcomePoint {
  needId: string;
  value: number;
  unit: string;
  year: number;
  severity: number;
  source: OutcomeSource;
  fetchedAt: string;
}

export interface OutcomesFile {
  generatedAt: string;
  series: OutcomePoint[];
  errors?: { needId: string; message: string; at: string }[];
}

export interface MeasuredPreview {
  items: string[];
  diff: { added: string[]; removed: string[]; moneyMovedB: number };
}

export function percentileRank(values: number[], value: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const first = sorted.findIndex((x) => x === value);
  const last = sorted.length - 1 - [...sorted].reverse().findIndex((x) => x === value);
  if (first < 0 || last < 0) return 0;
  if (sorted.length === 1) return 1;
  const avgRank = (first + last) / 2;
  return Math.max(0, Math.min(1, avgRank / (sorted.length - 1)));
}

export function addSeriesSeverity(points: Array<{ year: number; value: number }>): Array<{ year: number; value: number; severity: number }> {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const values = sorted.map((p) => p.value);
  return sorted.map((p) => ({ ...p, severity: percentileRank(values, p.value) }));
}

export async function loadOutcomesFile(path: string): Promise<OutcomesFile | null> {
  try {
    const f = Bun.file(path);
    if (!(await f.exists())) return null;
    const raw = await f.json();
    if (!raw || typeof raw !== "object") return null;
    const series = Array.isArray((raw as OutcomesFile).series) ? (raw as OutcomesFile).series : [];
    return {
      generatedAt: String((raw as OutcomesFile).generatedAt || ""),
      series: series.filter((r) => r && Number.isFinite(Number(r.value)) && Number.isFinite(Number(r.year))),
      errors: Array.isArray((raw as OutcomesFile).errors) ? (raw as OutcomesFile).errors : [],
    };
  } catch {
    return null;
  }
}

export function latestOutcomeByNeed(file: OutcomesFile | null): Record<string, OutcomePoint> {
  const out: Record<string, OutcomePoint> = {};
  for (const row of file?.series ?? []) {
    const k = String(row.needId || "");
    if (!k) continue;
    const prev = out[k];
    if (!prev || Number(row.year) > Number(prev.year)) out[k] = row;
  }
  return out;
}

export function measuredNeedsOutcomes(file: OutcomesFile | null): SynthesisOutcomes {
  const latest = latestOutcomeByNeed(file);
  const needs: Record<string, { severity: number }> = {};
  for (const [needId, row] of Object.entries(latest)) {
    if (!Number.isFinite(Number(row.severity))) continue;
    needs[needId] = { severity: Math.max(0, Math.min(1, Number(row.severity))) };
  }
  return { needs };
}

export function mergeOutcomes(base: SynthesisOutcomes | undefined, override: SynthesisOutcomes | undefined): SynthesisOutcomes | undefined {
  if (!base && !override) return undefined;
  return {
    needs: { ...(base?.needs ?? {}), ...(override?.needs ?? {}) },
    items: { ...(base?.items ?? {}), ...(override?.items ?? {}) },
  };
}

export function measuredPreviewByPackage(current: PackageResult[], measured: PackageResult[]): Record<string, MeasuredPreview> {
  const out: Record<string, MeasuredPreview> = {};
  const measuredById = new Map(measured.map((p) => [p.id, p]));

  for (const cur of current) {
    const nxt = measuredById.get(cur.id);
    if (!nxt) continue;
    const curIds = cur.items.map((i) => i.proposal.id);
    const nxtIds = nxt.items.map((i) => i.proposal.id);
    const curSet = new Set(curIds);
    const nxtSet = new Set(nxtIds);
    const added = nxtIds.filter((id) => !curSet.has(id));
    const removed = curIds.filter((id) => !nxtSet.has(id));

    const curCost = Object.fromEntries(cur.items.map((i) => [i.proposal.id, Number(i.proposal.costB ?? 0)]));
    const nxtCost = Object.fromEntries(nxt.items.map((i) => [i.proposal.id, Number(i.proposal.costB ?? 0)]));
    const moneyMovedB = [...added, ...removed].reduce((s, id) => s + Math.max(0, Number(curCost[id] ?? nxtCost[id] ?? 0)), 0);

    out[cur.id] = {
      items: nxtIds,
      diff: { added, removed, moneyMovedB: Number(moneyMovedB.toFixed(2)) },
    };
  }

  return out;
}

export function parseOutcomesMode(raw: string | undefined | null): OutcomesMode {
  const v = String(raw ?? "shadow").trim().toLowerCase();
  if (v === "off" || v === "on" || v === "shadow") return v;
  return "shadow";
}
