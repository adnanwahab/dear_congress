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
