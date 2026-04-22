import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { CoveringCell } from './algorithm/region-cover';

interface RawRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  created_at: Date;
}

@Injectable()
export class S2Repository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertLocation(loc: LocationInput): Promise<LocationRecord> {
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

  async findLocationById(id: string): Promise<LocationRecord | null> {
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
   * Query locations by S2 cell IDs.
   * cellIdsBigint must already be signed int64 strings (same bit pattern stored by the seeder).
   */
  async findLocationsByCells(cellIdsBigint: string[], limit: number): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE s2_cell_l16 = ANY($1::bigint[])
       LIMIT $2`,
      [cellIdsBigint, limit],
    );
    return res.rows;
  }

  async createGeofence(
    name: string,
    polygonGeoJson: object,
    covering: CoveringCell[],
  ): Promise<{ id: string; cellCount: number; levels: number[] }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const gf = await client.query<{ id: string }>(
        `INSERT INTO geofences (name, polygon_geojson) VALUES ($1, $2::jsonb) RETURNING id`,
        [name, JSON.stringify(polygonGeoJson)],
      );
      const id = gf.rows[0]!.id;

      if (covering.length > 0) {
        const placeholders = covering
          .map((_, i) => `($1, $${i * 2 + 2}::bigint, $${i * 2 + 3}::smallint)`)
          .join(', ');
        const params: (string | number)[] = [id];
        for (const c of covering) {
          params.push(c.cellId, c.level);
        }
        await client.query(
          `INSERT INTO geofence_cells (geofence_id, s2_cell_id, level) VALUES ${placeholders}`,
          params,
        );
      }

      await client.query('COMMIT');
      const levels = Array.from(new Set(covering.map((c) => c.level))).sort((a, b) => a - b);
      return { id, cellCount: covering.length, levels };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async distinctGeofenceLevels(): Promise<number[]> {
    const res = await this.pool.query<{ level: number }>(
      'SELECT DISTINCT level FROM geofence_cells ORDER BY level',
    );
    return res.rows.map((r) => r.level);
  }

  async matchGeofences(candidateCellIds: string[]): Promise<string[]> {
    if (candidateCellIds.length === 0) return [];
    const res = await this.pool.query<{ geofence_id: string }>(
      `SELECT DISTINCT geofence_id
       FROM geofence_cells
       WHERE s2_cell_id = ANY($1::bigint[])`,
      [candidateCellIds],
    );
    return res.rows.map((r) => r.geofence_id);
  }
}
