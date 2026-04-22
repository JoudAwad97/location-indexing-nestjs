/**
 * Radius → geohash precision map from article §4.
 * Each precision-N geohash covers a rectangle of the size shown in the article's table.
 * Pick the precision whose cell *comfortably contains* the search radius.
 */
export function precisionForRadius(radiusMeters: number): number {
  if (radiusMeters <= 600) return 7; // precision 7 ≈ 153m × 152m
  if (radiusMeters <= 5_000) return 6; // precision 6 ≈ 1.2km × 609m
  if (radiusMeters <= 20_000) return 5; // precision 5 ≈ 4.9km × 4.9km
  if (radiusMeters <= 100_000) return 4; // precision 4 ≈ 39km × 19km
  return 3;
}
