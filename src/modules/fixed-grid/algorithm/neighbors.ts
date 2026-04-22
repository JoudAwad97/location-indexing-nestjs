import { GRID_WIDTH, cellIndex } from './cell-id';

/**
 * Always return center cell + 8 neighbors.
 *
 * A query point near the edge of its cell has matching results in adjacent
 * cells. Omitting the neighbors is the canonical bug described in article §3.
 */
export function nineCellIds(lat: number, lng: number): number[] {
  const { latIdx, lngIdx } = cellIndex(lat, lng);
  const ids: number[] = [];
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      ids.push((latIdx + dLat) * GRID_WIDTH + (lngIdx + dLng));
    }
  }
  return ids;
}
