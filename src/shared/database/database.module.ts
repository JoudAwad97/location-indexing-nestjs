import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './tokens';
import { PostgresPoolProvider } from './postgres.provider';

@Global()
@Module({
  providers: [PostgresPoolProvider],
  exports: [PostgresPoolProvider],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
