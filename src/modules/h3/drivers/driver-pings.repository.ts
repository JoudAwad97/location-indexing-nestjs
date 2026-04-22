import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { encodeCell } from '../algorithm/cell';

export interface DriverPing {
  driver_id: string;
  lat: number;
  lng: number;
  h3_r9: string;
  seen_at: Date;
}

@Injectable()
export class DriverPingsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async upsertPing(input: { driverId: string; lat: number; lng: number }): Promise<void> {
    const cell = encodeCell(input.lat, input.lng);
    const cellBigint = BigInt(`0x${cell}`).toString();
    await this.pool.query(
      `INSERT INTO driver_pings (driver_id, lat, lng, h3_r9)
       VALUES ($1, $2, $3, $4::bigint)`,
      [input.driverId, input.lat, input.lng, cellBigint],
    );
  }

  async latestPingsNearCells(cellIdsBigint: string[], limit: number): Promise<DriverPing[]> {
    // For each driver, take the latest ping whose h3_r9 is in the target set.
    const res = await this.pool.query<DriverPing>(
      `SELECT DISTINCT ON (driver_id)
         driver_id, lat, lng, h3_r9::text AS h3_r9, seen_at
       FROM driver_pings
       WHERE h3_r9 = ANY($1::bigint[])
       ORDER BY driver_id, seen_at DESC
       LIMIT $2`,
      [cellIdsBigint, limit],
    );
    return res.rows;
  }
}
