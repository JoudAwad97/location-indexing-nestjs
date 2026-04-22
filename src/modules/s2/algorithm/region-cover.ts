import * as S2 from '@radarlabs/s2';
import { s2IdToSignedInt64 } from './cell';

export interface CoveringCell {
  cellId: string;
  level: number;
}

export interface RegionCoverOptions {
  minLevel: number;
  maxLevel: number;
  maxCells: number;
}

/**
 * Cover a circular radius around a point using RegionCoverer.getRadiusCovering.
 *
 * API adaptation (@radarlabs/s2 ^0.0.6):
 *   Plan used `coverBoundingBox` with `LatLngRect` + `RegionCoverer` instance — those
 *   don't exist in this version. Instead we use the static
 *   `RegionCoverer.getRadiusCovering(ll, radiusM, { min, max, max_cells })` which
 *   returns a CellUnion. We then read `.cellIds()` and convert each to signed int64.
 */
export function coverRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
  opts: RegionCoverOptions,
): CoveringCell[] {
  const ll = new S2.LatLng(lat, lng);
  const union = S2.RegionCoverer.getRadiusCovering(ll, radiusMeters, {
    min: opts.minLevel,
    max: opts.maxLevel,
    max_cells: opts.maxCells,
  });
  if (!union) return [];
  return union.cellIds().map((c) => ({
    cellId: s2IdToSignedInt64(c.id()).toString(),
    level: c.level(),
  }));
}

/**
 * Cover a GeoJSON Polygon (ring[0] = outer boundary; holes ignored).
 *
 * API adaptation (@radarlabs/s2 ^0.0.6):
 *   Plan used `S2.Loop` + `S2.Polygon` — neither class is exported by this package.
 *   Instead we use `RegionCoverer.getCovering(lls: LatLng[], options)` which takes
 *   an array of LatLng points forming the polygon boundary (outer ring) and returns
 *   a CellUnion.
 *
 *   GeoJSON rings close with a duplicate vertex (first == last). S2's Loop rejects
 *   degenerate edges so we strip the closing point before passing to getCovering.
 */
export function coverPolygon(coordinates: number[][][], opts: RegionCoverOptions): CoveringCell[] {
  const [outer] = coordinates;
  if (!outer || outer.length < 4) throw new Error('Polygon must have >= 4 points');

  // GeoJSON: [lng, lat] — convert to LatLng objects, dropping the closing duplicate vertex.
  const ring = outer.slice(0, -1); // remove last point (same as first in GeoJSON)
  const lls: S2.LatLng[] = ring.map(([lng, lat]) => new S2.LatLng(lat as number, lng as number));

  const union = S2.RegionCoverer.getCovering(lls, {
    min: opts.minLevel,
    max: opts.maxLevel,
    max_cells: opts.maxCells,
  });
  if (!union) return [];
  return union.cellIds().map((c) => ({
    cellId: s2IdToSignedInt64(c.id()).toString(),
    level: c.level(),
  }));
}
