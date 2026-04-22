import { Module } from '@nestjs/common';
import { AppConfigModule } from './shared/config/config.module';
import { AppLoggerModule } from './shared/logging/logger.module';
import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { TwoDSearchModule } from './modules/two-d-search/two-d-search.module';

@Module({
  imports: [AppConfigModule, AppLoggerModule, DatabaseModule, RedisModule, TwoDSearchModule],
})
export class AppModule {}
