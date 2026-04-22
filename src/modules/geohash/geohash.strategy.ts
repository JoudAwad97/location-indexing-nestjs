import { Injectable } from '@nestjs/common';
import ngeohash from 'ngeohash';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { nineHashes } from './algorithm/neighbors';
import { precisionForRadius } from './algorithm/precision';
import { GeohashPostgresRepository } from './geohash.postgres.repository';
import { GeohashRedisRepository } from './geohash.redis.repository';

export type GeohashEngine = 'postgres' | 'redis';

const MIN_PRECISION = 2;

@Injectable()
export class GeohashStrategy implements ProximityStrategy {
  readonly name = 'geohash';

  constructor(
    private readonly pg: GeohashPostgresRepository,
    private readonly redis: GeohashRedisRepository,
  ) {}

  /**
   * Dual-writer: Postgres is the system of record, Redis is the serving cache
   * for the `redis` engine. Postgres success is required; Redis failure logs
   * but does not fail the insert.
   */
  async insert(loc: LocationInput): Promise<LocationRecord> {
    const record = await this.pg.insert(loc);
    try {
      const { geohash_12 } = deriveColumns(loc);
      await this.redis.upsert({ name: record.name, lat: record.lat, lng: record.lng, geohash_12 });
    } catch (err) {
      // Best-effort mirror. Reseed to recover.
      console.error('[geohash] Redis mirror failed:', (err as Error).message);
    }
    return record;
  }

  findById(id: string): Promise<LocationRecord | null> {
    return this.pg.findById(id);
  }

  async findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
    minResults?: number;
    engine?: GeohashEngine;
  }): Promise<NearbyResult> {
    const engine: GeohashEngine = q.engine ?? 'postgres';
    const limit = q.limit ?? 50;
    const minResults = q.minResults ?? 0;
    const startedAt = Date.now();

    if (engine === 'redis') {
      const hits = await this.redis.searchByRadius(q.lat, q.lng, q.radiusMeters, limit);
      const results = hits.map((h) => ({
        id: h.member, // Redis member doubles as id here
        name: h.member.split('::')[0] ?? h.member,
        category: '<redis-geo>',
        lat: h.lat,
        lng: h.lng,
        createdAt: new Date(),
        distanceMeters: h.distanceMeters,
      }));
      return {
        strategy: `${this.name}:redis`,
        results,
        diagnostics: {
          cellsQueried: 0,
          expansionSteps: 0,
          latencyMs: Date.now() - startedAt,
          notes: { engine: 'redis GEOSEARCH', command: 'FROMLONLAT BYRADIUS' },
        },
      };
    }

    // Postgres prefix engine with expand-on-underflow.
    let precision = precisionForRadius(q.radiusMeters);
    let expansionSteps = 0;
    let prefixes = nineHashes(ngeohash.encode(q.lat, q.lng, precision));
    let rows = await this.pg.findByPrefixes(prefixes, limit * 5);

    while (rows.length < minResults && precision > MIN_PRECISION) {
      precision -= 1;
      expansionSteps += 1;
      prefixes = nineHashes(ngeohash.encode(q.lat, q.lng, precision));
      rows = await this.pg.findByPrefixes(prefixes, limit * 5);
    }

    const mapped = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        createdAt: r.created_at,
        distanceMeters: haversineMeters({ lat: q.lat, lng: q.lng }, { lat: r.lat, lng: r.lng }),
      }))
      .filter((r) => r.distanceMeters <= q.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return {
      strategy: `${this.name}:postgres`,
      results: mapped,
      diagnostics: {
        cellsQueried: prefixes.length,
        expansionSteps,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { finalPrecision: precision, prefixes },
      },
    };
  }
}
