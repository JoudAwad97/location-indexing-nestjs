import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';

export type H3Engine = 'h3-js' | 'h3-pg';

interface RawRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  created_at: Date;
}

@Injectable()
export class H3Repository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
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
   * h3-js engine: cells were computed in app, passed in as a bigint array.
   */
  async findByCells_jsEngine(cellIdsBigint: string[], limit: number): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE h3_r9 = ANY($1::bigint[])
       LIMIT $2`,
      [cellIdsBigint, limit],
    );
    return res.rows;
  }

  /**
   * h3-pg engine: uses the Postgres extension to compute the disk in SQL.
   * h3_grid_disk returns SETOF h3index (not an array), so we wrap it with
   * ARRAY(SELECT ...) before using = ANY().
   */
  async findByCells_pgEngine(
    centerCellBigint: string,
    k: number,
    limit: number,
  ): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `SELECT l.id, l.name, l.category, l.lat, l.lng, l.created_at
       FROM locations l
       WHERE l.h3_r9::h3index = ANY(
         ARRAY(SELECT h3_grid_disk($1::bigint::h3index, $2::integer))
       )
       LIMIT $3`,
      [centerCellBigint, k, limit],
    );
    return res.rows;
  }
}
