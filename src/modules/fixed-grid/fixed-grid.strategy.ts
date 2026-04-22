import { Injectable } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { nineCellIds } from './algorithm/neighbors';
import { FixedGridRepository } from './fixed-grid.repository';

@Injectable()
export class FixedGridStrategy implements ProximityStrategy {
  readonly name = 'fixed-grid';

  constructor(private readonly repo: FixedGridRepository) {}

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
  }): Promise<NearbyResult> {
    const startedAt = Date.now();
    const limit = q.limit ?? 50;
    const cellIds = nineCellIds(q.lat, q.lng);
    const { rows, perCell } = await this.repo.findByCells(cellIds, limit * 5);

    const withDistance = rows
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
      strategy: this.name,
      results: withDistance,
      diagnostics: {
        cellsQueried: cellIds.length,
        expansionSteps: 0,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { perCellHits: perCell },
      },
    };
  }
}
