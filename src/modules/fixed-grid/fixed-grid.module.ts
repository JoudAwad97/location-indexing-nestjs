import { Module } from '@nestjs/common';
import { FixedGridController } from './fixed-grid.controller';
import { FixedGridRepository } from './fixed-grid.repository';
import { FixedGridStrategy } from './fixed-grid.strategy';

@Module({
  controllers: [FixedGridController],
  providers: [FixedGridRepository, FixedGridStrategy],
  exports: [FixedGridStrategy],
})
export class FixedGridModule {}
