export type GeoCell = {
  lat: number; lng: number;
  real: { count: number; perNeed: { needId: string; count: number; demand: number }[] };
  simulated: { count: number; perNeed: { needId: string; count: number; demand: number }[] };
};

/** Keep sources separate, including when the UI requests both. Cells are already privacy-filtered by the server. */
export function needEvidence(cells: GeoCell[], mode: 'real' | 'simulated' | 'both', need: string) {
  return cells.flatMap(cell => (['real', 'simulated'] as const).flatMap(source => {
    if (mode !== 'both' && mode !== source) return [];
    const group = cell[source];
    const count = need === 'all' ? group.count : group.perNeed.find(p => p.needId === need)?.count ?? 0;
    if (!count) return [];
    return [{ lat: cell.lat, lng: cell.lng, source, count,
      label: source === 'real' ? 'Submitted accounts' : 'Simulated estimates' }];
  }));
}
