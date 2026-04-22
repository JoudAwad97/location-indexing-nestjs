import { bboxAround } from '@/shared/geo/bbox';

/**
 * 2D naive search: expand the query point into an axis-aligned lat/lng bbox
 * and push the bounds into SQL.
 *
 * Teaching point: a composite B-tree on (lat, lng) can only range-seek on
 * the first column. The lng range becomes a row-level filter — that's why
 * `EXPLAIN ANALYZE` shows a Bitmap Heap Scan with heavy "Rows Removed by Filter".
 */
export function searchBoundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number,
): ReturnType<typeof bboxAround> {
  return bboxAround(center, radiusMeters);
}
