import { Module } from '@nestjs/common';
import { TwoDSearchController } from './two-d-search.controller';
import { TwoDSearchRepository } from './two-d-search.repository';
import { TwoDSearchService } from './two-d-search.service';
import { TwoDSearchStrategy } from './two-d-search.strategy';

@Module({
  controllers: [TwoDSearchController],
  providers: [TwoDSearchRepository, TwoDSearchStrategy, TwoDSearchService],
  exports: [TwoDSearchStrategy],
})
export class TwoDSearchModule {}
