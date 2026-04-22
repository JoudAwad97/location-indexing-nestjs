import { haversineMeters } from '@/shared/geo/haversine';
import { QuadtreeNode } from './node';
import { QtBounds, QtItem } from './types';

export interface QueryStats {
  nodesVisited: number;
}

/**
 * Article §5 query algorithm:
 *   1) Traverse to the leaf containing the query point
 *   2) If not enough results, widen to the parent bbox and gather from siblings
 *
 * We implement the simpler equivalent: build a candidate bbox expanded from the
 * search radius, walk the tree collecting items whose leaf bounds intersect it,
 * then filter by haversine. This is O(k + results) where k is tree depth.
 */
export function queryRange(
  root: QuadtreeNode,
  center: { lat: number; lng: number },
  radiusMeters: number,
  bbox: QtBounds,
): { items: Array<QtItem & { distanceMeters: number }>; stats: QueryStats } {
  const out: Array<QtItem & { distanceMeters: number }> = [];
  let nodesVisited = 0;

  const stack: QuadtreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodesVisited += 1;
    if (!node.intersects(bbox)) continue;

    if (node.children) {
      for (const c of node.children) stack.push(c);
      continue;
    }

    for (const item of node.items) {
      const d = haversineMeters(center, { lat: item.lat, lng: item.lng });
      if (d <= radiusMeters) out.push({ ...item, distanceMeters: d });
    }
  }

  return { items: out, stats: { nodesVisited } };
}
