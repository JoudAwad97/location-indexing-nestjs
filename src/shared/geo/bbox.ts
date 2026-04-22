import { METERS_PER_DEG_LAT } from './constants';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Compute an axis-aligned bbox around a center point that fully contains
 * a circle of the given radius.
 *
 * Latitude: ~111.32 km/deg everywhere.
 * Longitude: shrinks with cos(lat) — reason 2D search "WHERE lng BETWEEN" breaks down.
 */
export function bboxAround(
  center: { lat: number; lng: number },
  radiusMeters: number,
): BoundingBox {
  const dLat = radiusMeters / METERS_PER_DEG_LAT;
  const phi = (center.lat * Math.PI) / 180;
  const dLng = radiusMeters / (METERS_PER_DEG_LAT * Math.cos(phi));

  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}
