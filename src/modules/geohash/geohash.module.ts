import { Module } from '@nestjs/common';
import { GeohashController } from './geohash.controller';
import { GeohashPostgresRepository } from './geohash.postgres.repository';
import { GeohashRedisRepository } from './geohash.redis.repository';
import { GeohashStrategy } from './geohash.strategy';

@Module({
  controllers: [GeohashController],
  providers: [GeohashPostgresRepository, GeohashRedisRepository, GeohashStrategy],
  exports: [GeohashStrategy],
})
export class GeohashModule {}
