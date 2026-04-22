import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisClientProvider } from './redis.provider';
import { REDIS_CLIENT } from './tokens';

@Global()
@Module({
  providers: [RedisClientProvider],
  exports: [RedisClientProvider],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
