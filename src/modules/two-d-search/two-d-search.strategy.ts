import { Injectable } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { searchBoundingBox } from './algorithm/bounding-box';
import { TwoDEngine, TwoDSearchRepository } from './two-d-search.repository';

@Injectable()
export class TwoDSearchStrategy implements ProximityStrategy {
  readonly name = 'two-d-search';

  constructor(private readonly repo: TwoDSearchRepository) {}

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
    engine?: TwoDEngine;
  }): Promise<NearbyResult> {
    const engine: TwoDEngine = q.engine ?? 'naive';
    const limit = q.limit ?? 50;
    const startedAt = Date.now();

    if (engine === 'naive') {
      const bbox = searchBoundingBox({ lat: q.lat, lng: q.lng }, q.radiusMeters);
      const { rows, planSummary } = await this.repo.findNaive(bbox, limit);
      const withDistance = rows
        .map((r) => ({
          ...{
            id: r.id,
            name: r.name,
            category: r.category,
            lat: r.lat,
            lng: r.lng,
            createdAt: r.created_at,
          },
          distanceMeters: haversineMeters({ lat: q.lat, lng: q.lng }, { lat: r.lat, lng: r.lng }),
        }))
        .filter((r) => r.distanceMeters <= q.radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      return {
        strategy: `${this.name}:naive`,
        results: withDistance,
        diagnostics: {
          cellsQueried: 1,
          expansionSteps: 0,
          latencyMs: Date.now() - startedAt,
          notes: { explainPlan: planSummary },
        },
      };
    }

    // postgis engine
    const rows = await this.repo.findPostgis({ lat: q.lat, lng: q.lng }, q.radiusMeters, limit);
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
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return {
      strategy: `${this.name}:postgis`,
      results: withDistance,
      diagnostics: {
        cellsQueried: 1,
        expansionSteps: 0,
        latencyMs: Date.now() - startedAt,
        notes: { indexUsed: 'idx_geog_gist (PostGIS GIST, sphere-aware)' },
      },
    };
  }
}
