import type { SimulationSnapshot } from "../engine/types";

/** Start a separate synthetic population experiment, retaining only public provenance. */
export function livingCityUrl(base: string, snapshot: SimulationSnapshot, seed: number): string {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("Invalid population seed");
  const url = new URL(`${base.replace(/\/+$/, "")}/world`);
  url.searchParams.set("living", "1");
  url.searchParams.set("seed", String(seed));
  url.searchParams.set("source", "dear-congress");
  url.searchParams.set("sourceSnapshot", snapshot.id);
  const point = snapshot.location;
  if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180) {
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lng", String(point.lng));
  }
  return url.href;
}
