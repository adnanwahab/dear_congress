// Geometry is static: calculate polygon centroids once, outside revision renders.
export function pathCentroid(path: string): [number, number] {
  let area = 0, x = 0, y = 0;
  for (const ring of path.split('M').slice(1)) {
    const points = [...ring.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!;
      const cross = a[0] * b[1] - b[0] * a[1];
      area += cross; x += (a[0] + b[0]) * cross; y += (a[1] + b[1]) * cross;
    }
  }
  return area ? [x / (3 * area), y / (3 * area)] : [0, 0];
}

export function rippleDelays(centers: readonly (readonly [number, number])[], origin: readonly [number, number]): number[] {
  const distances = centers.map(([x, y]) => Math.hypot(x - origin[0], y - origin[1]));
  const max = Math.max(...distances, 1);
  // 550ms travel + the existing 650ms fill transition = 1.2 seconds.
  return distances.map(distance => Math.round(distance / max * 550));
}
