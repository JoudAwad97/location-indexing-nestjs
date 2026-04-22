import { Module } from '@nestjs/common';
import { QuadtreeController } from './quadtree.controller';
import { QuadtreeRepository } from './quadtree.repository';
import { QuadtreeService } from './quadtree.service';
import { QuadtreeStrategy } from './quadtree.strategy';

@Module({
  controllers: [QuadtreeController],
  providers: [QuadtreeRepository, QuadtreeService, QuadtreeStrategy],
  exports: [QuadtreeStrategy, QuadtreeService],
})
export class QuadtreeModule {}
