import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { BoundingBox } from '@/shared/geo/bbox';

export type TwoDEngine = 'naive' | 'postgis';

interface RawRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  created_at: Date;
}

function mapRow(r: RawRow): LocationRecord {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
  };
}

@Injectable()
export class TwoDSearchRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const derived = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES
         ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [
        derived.name,
        derived.category,
        derived.lat,
        derived.lng,
        derived.geohash_12,
        derived.h3_r9,
        derived.s2_cell_l16,
        derived.grid_1km,
      ],
    );
    return mapRow(res.rows[0]!);
  }

  async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<RawRow>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async findNaive(
    bbox: BoundingBox,
    limit: number,
  ): Promise<{ rows: RawRow[]; planSummary: string }> {
    const client = await this.pool.connect();
    try {
      const planRes = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (FORMAT JSON)
           SELECT id, name, category, lat, lng, created_at
           FROM locations
           WHERE lat BETWEEN $1 AND $2
             AND lng BETWEEN $3 AND $4
           LIMIT $5`,
        [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng, limit],
      );
      const planSummary = JSON.stringify(planRes.rows[0], null, 2);

      const res = await client.query<RawRow>(
        `SELECT id, name, category, lat, lng, created_at
         FROM locations
         WHERE lat BETWEEN $1 AND $2
           AND lng BETWEEN $3 AND $4
         LIMIT $5`,
        [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng, limit],
      );
      return { rows: res.rows, planSummary };
    } finally {
      client.release();
    }
  }

  async findPostgis(
    center: { lat: number; lng: number },
    radiusMeters: number,
    limit: number,
  ): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE ST_DWithin(
               geog,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )
       LIMIT $4`,
      [center.lat, center.lng, radiusMeters, limit],
    );
    return res.rows;
  }
}
