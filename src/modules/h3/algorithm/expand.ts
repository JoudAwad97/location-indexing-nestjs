/**
 * Article §7 expand loop: if result count < minResults, widen the disk by one step.
 *
 * Formula for disk size at k: 3k(k+1)+1. So k=1 → 7 cells, k=2 → 19, k=3 → 37.
 * Stopping at max k prevents unbounded widening in sparse areas.
 */
export function initialKForRadius(radiusMeters: number, edgeMeters: number): number {
  if (radiusMeters <= edgeMeters) return 1;
  return Math.max(1, Math.ceil(radiusMeters / edgeMeters));
}

export const MAX_K = 10; // disk of 331 cells
