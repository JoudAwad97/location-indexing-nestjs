import { FactoryProvider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/config.service';
import { REDIS_CLIENT } from './tokens';

export const RedisClientProvider: FactoryProvider<Redis> = {
  provide: REDIS_CLIENT,
  inject: [AppConfigService],
  useFactory: (cfg: AppConfigService): Redis => {
    const log = new Logger('Redis');
    const client = new Redis({
      host: cfg.redis.host,
      port: cfg.redis.port,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    client.on('error', (err): void => log.error(`Redis error: ${err.message}`));
    client.on('connect', (): void => log.log('Redis connected'));
    return client;
  },
};
