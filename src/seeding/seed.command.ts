/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import Redis from 'ioredis';
import seedrandom from 'seedrandom';
import { loadConfig } from '../shared/config/config.schema';
import { cityClusterGenerator } from './generators/city-cluster';
import { hotspotGenerator } from './generators/hotspot';
import { uniformGenerator } from './generators/uniform';
import { Distribution, Generator } from './generators/generator.types';
import { deriveColumns } from './populate-derived-columns';

const GENERATORS: Record<Distribution, Generator> = {
  uniform: uniformGenerator,
  'city-cluster': cityClusterGenerator,
  hotspot: hotspotGenerator,
};

const BATCH_SIZE = 5_000;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      count: { type: 'string', default: '10000' },
      distribution: { type: 'string', default: 'city-cluster' },
      seed: { type: 'string', default: '42' },
      truncate: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  const count = Number(values.count);
  const distribution = values.distribution as Distribution;
  const seed = String(values.seed);
  const truncate = Boolean(values.truncate);

  if (!(distribution in GENERATORS)) {
    throw new Error(
      `Unknown --distribution=${distribution}. Pick one of: ${Object.keys(GENERATORS).join(', ')}`,
    );
  }

  const cfg = loadConfig();
  const pool = new Pool({
    host: cfg.postgres.host,
    port: cfg.postgres.port,
    database: cfg.postgres.database,
    user: cfg.postgres.user,
    password: cfg.postgres.password,
  });
  const redis = new Redis({ host: cfg.redis.host, port: cfg.redis.port });
  const rng = seedrandom(seed);

  console.log(
    `Seeding: count=${count} distribution=${distribution} seed=${seed} truncate=${truncate}`,
  );

  if (truncate) {
    await pool.query('TRUNCATE locations RESTART IDENTITY;');
    await redis.del('geo:locations');
    console.log('Truncated locations and Redis geo:locations');
  }

  const generator = GENERATORS[distribution];
  const rows = generator({ count, rng });

  let batch: ReturnType<typeof deriveColumns>[] = [];
  let total = 0;
  const startedAt = Date.now();

  for (const raw of rows) {
    batch.push(deriveColumns(raw));
    if (batch.length >= BATCH_SIZE) {
      await flushBatch(pool, redis, batch);
      total += batch.length;
      batch = [];
      if (total % 50_000 === 0) {
        console.log(`  inserted ${total.toLocaleString()} rows`);
      }
    }
  }
  if (batch.length > 0) {
    await flushBatch(pool, redis, batch);
    total += batch.length;
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(`Done. Inserted ${total.toLocaleString()} rows in ${elapsed}s`);

  await redis.quit();
  await pool.end();
}

async function flushBatch(
  pool: Pool,
  redis: Redis,
  batch: ReturnType<typeof deriveColumns>[],
): Promise<void> {
  const values: unknown[] = [];
  const placeholders: string[] = [];
  batch.forEach((r, idx) => {
    const base = idx * 8;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::bigint, $${base + 7}::bigint, $${base + 8}::bigint)`,
    );
    values.push(r.name, r.category, r.lat, r.lng, r.geohash_12, r.h3_r9, r.s2_cell_l16, r.grid_1km);
  });

  const sql = `
    INSERT INTO locations
      (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
    VALUES
      ${placeholders
        .map((p, i) => {
          const lngIdx = i * 8 + 4;
          const latIdx = i * 8 + 3;
          return p.replace(
            /\)$/,
            `, ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)::geography)`,
          );
        })
        .join(', ')}
  `;
  await pool.query(sql, values);

  // Redis pipeline: mirror each inserted row into the shared geo set.
  const pipeline = redis.pipeline();
  batch.forEach((r) => {
    pipeline.geoadd('geo:locations', r.lng, r.lat, `${r.name}::${r.geohash_12}`);
  });
  await pipeline.exec();
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
