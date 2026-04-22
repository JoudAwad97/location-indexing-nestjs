import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { bboxAround } from '@/shared/geo/bbox';
import { queryRange } from './algorithm/query';
import { QuadtreeRepository } from './quadtree.repository';
import { QuadtreeService } from './quadtree.service';

@Injectable()
export class QuadtreeStrategy implements ProximityStrategy {
  readonly name = 'quadtree';

  constructor(
    private readonly repo: QuadtreeRepository,
    private readonly tree: QuadtreeService,
  ) {}

  insert(loc: LocationInput): Promise<LocationRecord> {
    // The in-memory tree is read-only between rebuilds. Inserts go to Postgres;
    // they become visible in quadtree queries after the next restart (spec §7.4).
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
    if (!this.tree.ready) {
      throw new ServiceUnavailableException({
        message: 'Quadtree still building. Retry shortly.',
        retryAfterSeconds: 5,
      });
    }

    const startedAt = Date.now();
    const limit = q.limit ?? 50;
    const bbox = bboxAround({ lat: q.lat, lng: q.lng }, q.radiusMeters);
    const { items, stats } = queryRange(
      this.tree.root,
      { lat: q.lat, lng: q.lng },
      q.radiusMeters,
      bbox,
    );

    const results = items.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit);

    return {
      strategy: this.name,
      results: results.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        createdAt: r.createdAt,
        distanceMeters: r.distanceMeters,
      })),
      diagnostics: {
        cellsQueried: stats.nodesVisited,
        expansionSteps: 0,
        latencyMs: Date.now() - startedAt,
        notes: this.tree.stats
          ? {
              treeItemCount: this.tree.stats.itemCount,
              treeLeafCount: this.tree.stats.leafCount,
              treeInternalCount: this.tree.stats.internalCount,
              treeMaxDepth: this.tree.stats.maxDepth,
            }
          : undefined,
      },
    };
  }
}
