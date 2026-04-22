import { FactoryProvider, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/config.service';
import { PG_POOL } from './tokens';

export const PostgresPoolProvider: FactoryProvider<Pool> = {
  provide: PG_POOL,
  inject: [AppConfigService],
  useFactory: (cfg: AppConfigService): Pool => {
    const pool = new Pool({
      host: cfg.postgres.host,
      port: cfg.postgres.port,
      database: cfg.postgres.database,
      user: cfg.postgres.user,
      password: cfg.postgres.password,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    const log = new Logger('PostgresPool');
    pool.on('error', (err) => log.error(`Pool error: ${err.message}`));
    return pool;
  },
};
