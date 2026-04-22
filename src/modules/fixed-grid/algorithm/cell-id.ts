import { FIXED_GRID_CELL_DEGREES } from '@/seeding/populate-derived-columns';

/**
 * Cell ID formula from the article:
 *
 *   cell_id = floor(lat / cellSize) * gridWidth + floor(lng / cellSize)
 *
 * We shift lat by +90 and lng by +180 so cell IDs are non-negative integers
 * that fit comfortably in a 53-bit JS number.
 */
export const CELL_SIZE_DEGREES = FIXED_GRID_CELL_DEGREES;
export const GRID_WIDTH = Math.floor(360 / CELL_SIZE_DEGREES);

export function cellIdOf(lat: number, lng: number): number {
  const latIdx = Math.floor((lat + 90) / CELL_SIZE_DEGREES);
  const lngIdx = Math.floor((lng + 180) / CELL_SIZE_DEGREES);
  return latIdx * GRID_WIDTH + lngIdx;
}

export function cellIndex(lat: number, lng: number): { latIdx: number; lngIdx: number } {
  return {
    latIdx: Math.floor((lat + 90) / CELL_SIZE_DEGREES),
    lngIdx: Math.floor((lng + 180) / CELL_SIZE_DEGREES),
  };
}
