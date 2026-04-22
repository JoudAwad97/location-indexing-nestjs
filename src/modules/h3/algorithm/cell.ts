import { latLngToCell, cellToLatLng, gridDisk, gridRingUnsafe } from 'h3-js';

export const H3_RES_POINT = 9; // ~0.1km² — one row per ~100m × 100m area

export function encodeCell(lat: number, lng: number, res = H3_RES_POINT): string {
  return latLngToCell(lat, lng, res);
}

export function cellCenter(cell: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/** `gridDisk(center, k)` = filled disk of all cells within k steps (article §7). */
export function diskCells(center: string, k: number): string[] {
  return gridDisk(center, k);
}

/** Hollow ring at exactly k steps — used by demand-forecasting examples in article §7. */
export function ringCells(center: string, k: number): string[] {
  return gridRingUnsafe(center, k);
}
