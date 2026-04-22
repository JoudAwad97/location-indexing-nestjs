import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';

interface RawRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  created_at: Date;
}

@Injectable()
export class GeohashPostgresRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES
         ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [d.name, d.category, d.lat, d.lng, d.geohash_12, d.h3_r9, d.s2_cell_l16, d.grid_1km],
    );
    const r = res.rows[0]!;
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      lat: r.lat,
      lng: r.lng,
      createdAt: r.created_at,
    };
  }

  async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<RawRow>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    const r = res.rows[0];
    return r
      ? {
          id: r.id,
          name: r.name,
          category: r.category,
          lat: r.lat,
          lng: r.lng,
          createdAt: r.created_at,
        }
      : null;
  }

  /**
   * Query by prefix. `LIKE ANY` with `varchar_pattern_ops` index turns each
   * `prefix%` into a B-tree range scan on the geohash_12 column.
   */
  async findByPrefixes(prefixes: string[], limit: number): Promise<RawRow[]> {
    const patterns = prefixes.map((p) => `${p}%`);
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE geohash_12 LIKE ANY($1::text[])
       LIMIT $2`,
      [patterns, limit],
    );
    return res.rows;
  }
}
