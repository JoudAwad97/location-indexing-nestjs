import { Injectable } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { S2_LEVEL_POINT, latLngToCellId } from './algorithm/cell';
import { coverRadius, coverPolygon, CoveringCell } from './algorithm/region-cover';
import { S2Repository } from './s2.repository';

@Injectable()
export class S2Strategy implements ProximityStrategy {
  readonly name = 's2';

  constructor(private readonly repo: S2Repository) {}

  insert(loc: LocationInput): Promise<LocationRecord> {
    return this.repo.insertLocation(loc);
  }

  findById(id: string): Promise<LocationRecord | null> {
    return this.repo.findLocationById(id);
  }

  async findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
  }): Promise<NearbyResult> {
    const startedAt = Date.now();
    const limit = q.limit ?? 50;

    // API adaptation: use getRadiusCovering instead of coverBoundingBox + LatLngRect
    // which don't exist in @radarlabs/s2 ^0.0.6.
    const covering = coverRadius(q.lat, q.lng, q.radiusMeters, {
      minLevel: S2_LEVEL_POINT,
      maxLevel: S2_LEVEL_POINT,
      maxCells: 64,
    });
    const cellIds = covering.map((c) => c.cellId);

    const rows = await this.repo.findLocationsByCells(cellIds, limit * 5);
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
      strategy: this.name,
      results: mapped,
      diagnostics: {
        cellsQueried: cellIds.length,
        expansionSteps: 0,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { level: S2_LEVEL_POINT },
      },
    };
  }

  async createGeofence(input: {
    name: string;
    polygon: { type: 'Polygon'; coordinates: number[][][] };
  }): Promise<{ id: string; cellCount: number; levels: number[]; coveringSample: CoveringCell[] }> {
    // API adaptation: use getCovering(lls[]) instead of Loop+Polygon+instance.getCoveringCells()
    // which don't exist in @radarlabs/s2 ^0.0.6.
    const covering = coverPolygon(input.polygon.coordinates, {
      minLevel: 10,
      maxLevel: 16,
      maxCells: 64,
    });
    const created = await this.repo.createGeofence(input.name, input.polygon, covering);
    return { ...created, coveringSample: covering.slice(0, 10) };
  }

  async matchPoint(
    lat: number,
    lng: number,
  ): Promise<{ matches: string[]; candidatesChecked: number; levels: number[] }> {
    const levels = await this.repo.distinctGeofenceLevels();
    // Compute cell ID at each distinct level used by stored geofences; already signed int64.
    const candidates = levels.map((lv) => latLngToCellId(lat, lng, lv));
    const matches = await this.repo.matchGeofences(candidates);
    return { matches, candidatesChecked: candidates.length, levels };
  }
}
