import { Injectable } from '@nestjs/common';
import { getHexagonEdgeLengthAvg, UNITS } from 'h3-js';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { H3_RES_POINT, diskCells, encodeCell } from './algorithm/cell';
import { MAX_K, initialKForRadius } from './algorithm/expand';
import { H3Engine, H3Repository } from './h3.repository';

@Injectable()
export class H3Strategy implements ProximityStrategy {
  readonly name = 'h3';

  constructor(private readonly repo: H3Repository) {}

  insert(loc: LocationInput): Promise<LocationRecord> {
    return this.repo.insert(loc);
  }
  findById(id: string): Promise<LocationRecord | null> {
    return this.repo.findById(id);
  }

  async findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
    minResults?: number;
    engine?: H3Engine;
  }): Promise<NearbyResult> {
    const engine: H3Engine = q.engine ?? 'h3-js';
    const limit = q.limit ?? 50;
    const minResults = q.minResults ?? 0;
    const startedAt = Date.now();

    const center = encodeCell(q.lat, q.lng, H3_RES_POINT);
    // Average hex edge length at resolution 9 ≈ 174m.
    const edgeMeters = getHexagonEdgeLengthAvg(H3_RES_POINT, UNITS.m);
    let k = initialKForRadius(q.radiusMeters, edgeMeters);
    let expansionSteps = 0;
    let rows: Awaited<ReturnType<typeof this.repo.findByCells_jsEngine>> = [];
    let lastCellCount = 0;

    while (true) {
      if (engine === 'h3-js') {
        const cells = diskCells(center, k);
        lastCellCount = cells.length;
        // h3-js returns cell ids as hex strings; cast via h3_string_to_int is cleaner,
        // but the h3-js ids are already BigInt-compatible when parsed in Postgres.
        // We store h3_r9 as BIGINT. To compare, convert to decimal string:
        const cellsAsBigint = cells.map((c) => BigInt(`0x${c}`).toString());
        rows = await this.repo.findByCells_jsEngine(cellsAsBigint, limit * 5);
      } else {
        const centerBigint = BigInt(`0x${center}`).toString();
        rows = await this.repo.findByCells_pgEngine(centerBigint, k, limit * 5);
        lastCellCount = 3 * k * (k + 1) + 1;
      }

      if (rows.length >= minResults || k >= MAX_K) break;
      k += 1;
      expansionSteps += 1;
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
      strategy: `${this.name}:${engine}`,
      results: mapped,
      diagnostics: {
        cellsQueried: lastCellCount,
        expansionSteps,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { resolution: H3_RES_POINT, k },
      },
    };
  }
}
