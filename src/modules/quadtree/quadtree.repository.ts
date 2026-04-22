import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { QtItem } from './algorithm/types';

const STREAM_BATCH = 10_000;

@Injectable()
export class QuadtreeRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<{
      id: string;
      name: string;
      category: string;
      lat: number;
      lng: number;
      created_at: Date;
    }>(
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
    const res = await this.pool.query<{
      id: string;
      name: string;
      category: string;
      lat: number;
      lng: number;
      created_at: Date;
    }>('SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1', [id]);
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

  /** Stream every location in batches for quadtree build. */
  async *streamAll(): AsyncIterable<QtItem> {
    let offset = 0;
    while (true) {
      const res = await this.pool.query<{
        id: string;
        name: string;
        category: string;
        lat: number;
        lng: number;
        created_at: Date;
      }>(
        `SELECT id, name, category, lat, lng, created_at
         FROM locations
         ORDER BY id
         LIMIT $1 OFFSET $2`,
        [STREAM_BATCH, offset],
      );
      if (res.rows.length === 0) break;
      for (const r of res.rows) {
        yield {
          id: r.id,
          name: r.name,
          category: r.category,
          lat: r.lat,
          lng: r.lng,
          createdAt: r.created_at,
        };
      }
      if (res.rows.length < STREAM_BATCH) break;
      offset += res.rows.length;
    }
  }
}
