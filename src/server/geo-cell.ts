export const CELL_SIZE_DEG = 0.01;

/**
 * Map coordinates to a stable 0.01° cell using integer-space flooring.
 *
 * The +1e-9 guard prevents floating-point drift from pushing already-cell-aligned
 * values down one extra bucket (e.g. -163.83 -> -163.84).
 */
export function cellCoord(v: number): number {
  return Number((Math.round(Math.floor(v * 100 + 1e-9)) / 100).toFixed(2));
}

/** Store real-entry coordinates directly at their 0.01° privacy cell. */
export function storeRealCoord(v: number): number {
  return cellCoord(v);
}

/**
 * Store simulated-entry coordinates at 3 decimals using integer-safe flooring.
 * This preserves binning invariance at 0.01°: cellCoord(storeSimulatedCoord(v)) === cellCoord(v).
 */
export function storeSimulatedCoord(v: number): number {
  return Number((Math.floor(v * 1000 + 1e-9) / 1000).toFixed(3));
}
