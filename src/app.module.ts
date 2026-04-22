import { Module } from '@nestjs/common';
import { AppConfigModule } from './shared/config/config.module';
import { AppLoggerModule } from './shared/logging/logger.module';
import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { TwoDSearchModule } from './modules/two-d-search/two-d-search.module';
import { FixedGridModule } from './modules/fixed-grid/fixed-grid.module';
import { GeohashModule } from './modules/geohash/geohash.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    RedisModule,
    TwoDSearchModule,
    FixedGridModule,
    GeohashModule,
  ],
})
export class AppModule {}
