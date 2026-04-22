import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppConfigModule } from './shared/config/config.module';
import { AppLoggerModule } from './shared/logging/logger.module';
import { RequestIdMiddleware } from './shared/logging/request-id.middleware';
import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { TwoDSearchModule } from './modules/two-d-search/two-d-search.module';
import { FixedGridModule } from './modules/fixed-grid/fixed-grid.module';
import { GeohashModule } from './modules/geohash/geohash.module';
import { QuadtreeModule } from './modules/quadtree/quadtree.module';
import { S2Module } from './modules/s2/s2.module';
import { H3Module } from './modules/h3/h3.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    RedisModule,
    TwoDSearchModule,
    FixedGridModule,
    GeohashModule,
    QuadtreeModule,
    S2Module,
    H3Module,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
