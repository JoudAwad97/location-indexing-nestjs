import ngeohash from 'ngeohash';

/**
 * Article §4, "Boundary Issue 1": a query cell at the edge of its geohash region
 * misses neighbors on the other side of the boundary unless we always query
 * center + 8 neighbors.
 *
 * `ngeohash.neighbors(hash)` returns the 8 surrounding hashes in a fixed order.
 */
export function nineHashes(hash: string): string[] {
  return [hash, ...ngeohash.neighbors(hash)];
}
