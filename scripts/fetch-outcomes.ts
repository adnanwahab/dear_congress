#!/usr/bin/env bun
import { addSeriesSeverity, type OutcomePoint, type OutcomeSource, type OutcomesFile } from "../src/server/outcomes";

const OUT_PATH = process.env.OUTCOMES_PATH ?? "data/outcomes.json";
const CENSUS_API_KEY = (process.env.CENSUS_API_KEY ?? "").trim();

const DAY_MS = 24 * 60 * 60 * 1000;

interface NeedSeriesInput {
  needId: string;
  unit: string;
  source: OutcomeSource;
  points: Array<{ year: number; value: number }>;
}

interface BuildResult {
  file: OutcomesFile;
}

function isFiniteNum(v: unknown): v is number {
  return Number.isFinite(Number(v));
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function rollingAvg3(points: Array<{ year: number; value: number }>): Array<{ year: number; value: number }> {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const byYear = new Map(sorted.map((p) => [p.year, p.value]));
  return sorted.map((p) => {
    const xs: number[] = [];
    for (let y = p.year - 2; y <= p.year; y++) {
      const v = byYear.get(y);
      if (isFiniteNum(v)) xs.push(Number(v));
    }
    return { year: p.year, value: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : p.value };
  });
}

function toRows(input: NeedSeriesInput, fetchedAt: string): OutcomePoint[] {
  const enriched = addSeriesSeverity(input.points);
  return enriched.map((p) => ({
    needId: input.needId,
    unit: input.unit,
    value: Number(p.value),
    year: Number(p.year),
    severity: Number(p.severity.toFixed(6)),
    source: input.source,
    fetchedAt,
  }));
}

function keepPreviousNeed(previous: OutcomesFile | null, needId: string): OutcomePoint[] {
  return (previous?.series ?? []).filter((r) => r.needId === needId);
}

export async function fetchFloodingClaimsSeries(fetchImpl: typeof fetch = fetch): Promise<Array<{ year: number; value: number }>> {
  const base = "https://www.fema.gov/api/open/v2/FimaNfipClaims";
  const top = 1000;
  let skip = 0;
  const counts = new Map<number, number>();

  for (;;) {
    const url = new URL(base);
    url.searchParams.set("$select", "yearOfLoss,countyCode");
    url.searchParams.set("$filter", "countyCode eq '48201' and yearOfLoss ne null");
    url.searchParams.set("$top", String(top));
    url.searchParams.set("$skip", String(skip));

    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`FEMA HTTP ${res.status}`);
    const payload = await res.json() as { FimaNfipClaims?: Array<{ yearOfLoss?: string | number }> };
    const rows = Array.isArray(payload?.FimaNfipClaims) ? payload.FimaNfipClaims : [];

    for (const row of rows) {
      const y = Number(row?.yearOfLoss);
      if (!Number.isFinite(y) || y < 1900) continue;
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }

    if (rows.length < top) break;
    skip += top;
  }

  const out = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ year, value }));

  return rollingAvg3(out);
}

export async function fetchTransitSeries(fetchImpl: typeof fetch = fetch): Promise<Array<{ year: number; value: number }>> {
  const nowYear = new Date().getUTCFullYear();
  const startYear = 2015;
  const out: Array<{ year: number; value: number }> = [];

  for (let year = startYear; year <= nowYear; year++) {
    const url = new URL(`https://api.census.gov/data/${year}/acs/acs1`);
    url.searchParams.set("get", "NAME,B08303_001E,B08303_012E,B08303_013E");
    url.searchParams.set("for", "county:201");
    url.searchParams.set("in", "state:48");
    if (CENSUS_API_KEY) url.searchParams.set("key", CENSUS_API_KEY);

    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) continue;
    const rows = await res.json() as string[][];
    if (!Array.isArray(rows) || rows.length < 2) continue;
    const data = rows[1] ?? [];
    const total = Number(data[1]);
    const long60 = Number(data[2]) + Number(data[3]);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(long60)) continue;
    out.push({ year, value: long60 / total });
  }

  if (!out.length) throw new Error("ACS returned no usable yearly rows");
  return out;
}

function parseArcDate(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : null;
}

function isStreetLikeType(s: string): boolean {
  const t = s.toLowerCase();
  return t.includes("pothole") || t.includes("streetlight") || t.includes("street");
}

async function fetchArcgisAll(fetchImpl: typeof fetch, baseUrl: string): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  const page = 2000;
  let offset = 0;

  for (;;) {
    const url = new URL(baseUrl);
    url.searchParams.set("where", "1=1");
    url.searchParams.set("outFields", "*");
    url.searchParams.set("returnGeometry", "false");
    url.searchParams.set("f", "json");
    url.searchParams.set("resultOffset", String(offset));
    url.searchParams.set("resultRecordCount", String(page));

    const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`ArcGIS HTTP ${res.status}: ${baseUrl}`);
    const payload = await res.json() as { features?: Array<{ attributes?: Record<string, unknown> }> };
    const rows = Array.isArray(payload?.features) ? payload.features : [];
    for (const row of rows) if (row?.attributes) out.push(row.attributes);

    if (rows.length < page) break;
    offset += page;
  }

  return out;
}

export async function fetchStreetsSeries(fetchImpl: typeof fetch = fetch): Promise<Array<{ year: number; value: number }>> {
  const endpoints = [
    "https://mycity.houstontx.gov/arcgis/rest/services/wm/Houston311_RecentServiceRequests/MapServer/0/query",
    "https://mycity.houstontx.gov/arcgis/rest/services/wm/311_ARCHIVED_CASES/MapServer/0/query",
  ];

  const attrs = (await Promise.all(endpoints.map((u) => fetchArcgisAll(fetchImpl, u)))).flat();
  const byYear = new Map<number, number[]>();

  for (const a of attrs) {
    const type = String(
      a.SR_TYPE ?? a.SERVICE_TYPE ?? a.REQUEST_TYPE ?? a.CASE_TYPE ?? a.sr_type ?? a.service_type ?? "",
    );
    if (!isStreetLikeType(type)) continue;

    const created = parseArcDate(a.SR_CREATE_DATE ?? a.CREATE_DATE ?? a.CREATED_DATE ?? a.CREATED_AT ?? a.created_date);
    const closed = parseArcDate(a.SR_CLOSED_DATE ?? a.CLOSE_DATE ?? a.CLOSED_DATE ?? a.CLOSED_AT ?? a.closed_date);
    if (!created || !closed || closed < created) continue;

    const year = new Date(created).getUTCFullYear();
    const days = (closed - created) / DAY_MS;
    if (!Number.isFinite(days) || days < 0 || days > 3650) continue;

    const arr = byYear.get(year) ?? [];
    arr.push(days);
    byYear.set(year, arr);
  }

  const out = [...byYear.entries()]
    .map(([year, vals]) => ({ year, value: median(vals) }))
    .sort((a, b) => a.year - b.year);

  if (!out.length) throw new Error("311 feeds returned no usable rows");
  return out;
}

export async function buildOutcomesFile(previous: OutcomesFile | null, fetchImpl: typeof fetch = fetch): Promise<BuildResult> {
  const fetchedAt = new Date().toISOString();
  const errors: Array<{ needId: string; message: string; at: string }> = [];
  const series: OutcomePoint[] = [];

  const jobs: Array<{ needId: string; run: () => Promise<NeedSeriesInput> }> = [
    {
      needId: "flooding",
      run: async () => ({
        needId: "flooding",
        unit: "claims/year (3-year avg)",
        source: {
          name: "OpenFEMA NFIP claims, Harris County",
          url: "https://www.fema.gov/openfema-data-page/fima-nfip-redacted-claims-v2",
          caveat: "Insurance claims undercount uninsured losses and may revise as claims settle.",
        },
        points: await fetchFloodingClaimsSeries(fetchImpl),
      }),
    },
    {
      needId: "transit",
      run: async () => ({
        needId: "transit",
        unit: "share of workers commuting 60+ minutes",
        source: {
          name: "U.S. Census ACS 1-year (B08303), Harris County",
          url: "https://api.census.gov/data.html",
          caveat: "Survey estimate with sampling error; year-to-year movement can be noisy.",
        },
        points: await fetchTransitSeries(fetchImpl),
      }),
    },
    {
      needId: "streets",
      run: async () => ({
        needId: "streets",
        unit: "median days to close 311 street requests",
        source: {
          name: "Houston 311 service request feeds",
          url: "https://mycity.houstontx.gov/arcgis/rest/services/wm/",
          caveat: "Operational closures reflect workflow/queue changes as well as street conditions.",
        },
        points: await fetchStreetsSeries(fetchImpl),
      }),
    },
  ];

  for (const job of jobs) {
    try {
      const data = await job.run();
      series.push(...toRows(data, fetchedAt));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ needId: job.needId, message, at: fetchedAt });
      series.push(...keepPreviousNeed(previous, job.needId));
    }
  }

  return {
    file: {
      generatedAt: fetchedAt,
      series: series.sort((a, b) => a.needId.localeCompare(b.needId) || a.year - b.year),
      errors,
    },
  };
}

if (import.meta.main) {
  const previous = await Bun.file(OUT_PATH).exists() ? (await Bun.file(OUT_PATH).json() as OutcomesFile) : null;
  const { file } = await buildOutcomesFile(previous, fetch);
  await Bun.write(OUT_PATH, JSON.stringify(file, null, 2));
  console.log(`Wrote ${OUT_PATH}: ${file.series.length} rows (${new Set(file.series.map((r) => r.needId)).size} needs)`);
  if ((file.errors ?? []).length) {
    console.warn("Fetch errors:");
    for (const e of file.errors ?? []) console.warn(`- ${e.needId}: ${e.message}`);
  }
}
