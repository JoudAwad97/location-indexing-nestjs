import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '@/shared/config/config.service';
import { BuildStats, buildQuadtree } from './algorithm/build';
import { QuadtreeNode } from './algorithm/node';
import { QtBounds, QtItem } from './algorithm/types';
import { QuadtreeRepository } from './quadtree.repository';

@Injectable()
export class QuadtreeService implements OnModuleInit {
  private readonly log = new Logger(QuadtreeService.name);
  private _root: QuadtreeNode | null = null;
  private _stats: BuildStats | null = null;
  private _ready = false;

  constructor(
    private readonly repo: QuadtreeRepository,
    private readonly cfg: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bounds: QtBounds = this.cfg.quadtree.bbox;
    this.log.log('Streaming locations to build quadtree...');

    // Buffer the async iterable to feed a synchronous build.
    const items: QtItem[] = [];
    for await (const item of this.repo.streamAll()) items.push(item);

    const { root, stats } = buildQuadtree(bounds, items, this.cfg.quadtree.leafCapacity);
    this._root = root;
    this._stats = stats;
    this._ready = true;
    this.log.log(
      `Quadtree ready: items=${stats.itemCount} leaves=${stats.leafCount} ` +
        `internal=${stats.internalCount} maxDepth=${stats.maxDepth} buildMs=${stats.buildMs}`,
    );
  }

  get ready(): boolean {
    return this._ready;
  }
  get stats(): BuildStats | null {
    return this._stats;
  }
  get root(): QuadtreeNode {
    if (!this._root) throw new Error('Quadtree not ready');
    return this._root;
  }
}
