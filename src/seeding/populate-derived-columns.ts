import ngeohash from 'ngeohash';
import { latLngToCell } from 'h3-js';
import * as S2 from '@radarlabs/s2';
import { GeneratedLocation } from './generators/generator.types';

export const GEOHASH_PRECISION = 12;
export const H3_RES_9 = 9;
export const S2_LEVEL_16 = 16;
export const FIXED_GRID_CELL_DEGREES = 0.009; // ≈ 1km at the equator

export interface DerivedRow {
  name: string;
  category: string;
  lat: number;
  lng: number;
  geohash_12: string;
  h3_r9: string; // H3 JS returns string; stored as BIGINT via ::bigint cast
  s2_cell_l16: string; // S2 cell ID as unsigned 64-bit string
  grid_1km: number;
}

/**
 * Derive all indexed columns from raw lat/lng.
 * Called once per row at seed time and during runtime INSERTs.
 *
 * S2 API note (@radarlabs/s2 ^0.0.6):
 *   The plan text referenced `S2.CellId.fromLatLng(...)` which does NOT exist.
 *   The constructor `new S2.CellId(latLng: LatLng)` is used instead.
 *   `CellId.id()` returns a bigint (unsigned); reinterpret as signed int64 for Postgres BIGINT.
 *
 * H3 note: h3-js returns hex strings (e.g. "89283082c6fffff"). Postgres BIGINT requires
 *   decimal. We convert via BigInt('0x' + hexStr).toString() before inserting.
 */

/** Reinterpret an unsigned 64-bit S2 cell ID as a signed int64 for Postgres BIGINT storage. */
const INT64_MAX = BigInt('9223372036854775807');
const UINT64_MOD = BigInt('18446744073709551616'); // 2^64

function s2IdToSignedInt64String(id: bigint): string {
  return (id > INT64_MAX ? id - UINT64_MOD : id).toString();
}

export function deriveColumns(loc: GeneratedLocation): DerivedRow {
  const geohash_12 = ngeohash.encode(loc.lat, loc.lng, GEOHASH_PRECISION);
  // h3-js returns a hex string; convert to decimal string for Postgres BIGINT compatibility
  const h3_r9 = BigInt('0x' + latLngToCell(loc.lat, loc.lng, H3_RES_9)).toString();

  // @radarlabs/s2 ^0.0.6: constructor takes LatLng directly; id() returns unsigned bigint.
  // Reinterpret as signed int64 for Postgres BIGINT (bit pattern preserved).
  const s2_cell_l16 = s2IdToSignedInt64String(
    new S2.CellId(new S2.LatLng(loc.lat, loc.lng)).parent(S2_LEVEL_16).id(),
  );

  // Fixed-grid cell: coarse integer derived from degree-quantized lat/lng.
  // grid_w chosen so cell IDs stay in 53-bit safe-integer range.
  const gridW = Math.floor(360 / FIXED_GRID_CELL_DEGREES);
  const grid_1km =
    Math.floor((loc.lat + 90) / FIXED_GRID_CELL_DEGREES) * gridW +
    Math.floor((loc.lng + 180) / FIXED_GRID_CELL_DEGREES);

  return {
    name: loc.name,
    category: loc.category,
    lat: loc.lat,
    lng: loc.lng,
    geohash_12,
    h3_r9,
    s2_cell_l16,
    grid_1km,
  };
}
