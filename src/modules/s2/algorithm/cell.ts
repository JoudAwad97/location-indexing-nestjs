import * as S2 from '@radarlabs/s2';

export const S2_LEVEL_POINT = 16;

/** Reinterpret an unsigned 64-bit S2 cell ID as a signed int64 for Postgres BIGINT storage/query. */
const INT64_MAX = BigInt('9223372036854775807');
const UINT64_MOD = BigInt('18446744073709551616'); // 2^64

export function s2IdToSignedInt64(id: bigint): bigint {
  return id > INT64_MAX ? id - UINT64_MOD : id;
}

/**
 * Convert (lat, lng) to the enclosing S2 cell ID at the given level.
 *
 * API note (@radarlabs/s2 ^0.0.6):
 *   No static `CellId.fromLatLng()`. Constructor `new S2.CellId(latLng: LatLng)` is used.
 *   Returns the signed int64 string for Postgres BIGINT compatibility.
 */
export function latLngToCellId(lat: number, lng: number, level: number): string {
  const id = new S2.CellId(new S2.LatLng(lat, lng)).parent(level).id();
  return s2IdToSignedInt64(id).toString();
}
