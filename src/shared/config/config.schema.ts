import { cleanEnv, str, port, num } from 'envalid';

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  readonly postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    url: string;
  };
  readonly redis: {
    host: string;
    port: number;
  };
  readonly quadtree: {
    leafCapacity: number;
    bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  };
  readonly h3Simulator: {
    bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  };
} {
  const env = cleanEnv(source, {
    NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
    PORT: port({ default: 3000 }),
    LOG_LEVEL: str({
      choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
      default: 'info',
    }),

    POSTGRES_HOST: str({ default: 'localhost' }),
    POSTGRES_PORT: port({ default: 5432 }),
    POSTGRES_DB: str({ default: 'location_indexing' }),
    POSTGRES_USER: str({ default: 'postgres' }),
    POSTGRES_PASSWORD: str({ default: 'postgres' }),

    REDIS_HOST: str({ default: 'localhost' }),
    REDIS_PORT: port({ default: 6379 }),

    QUADTREE_LEAF_CAPACITY: num({ default: 100 }),
    QUADTREE_BBOX_MIN_LAT: num({ default: -90 }),
    QUADTREE_BBOX_MAX_LAT: num({ default: 90 }),
    QUADTREE_BBOX_MIN_LNG: num({ default: -180 }),
    QUADTREE_BBOX_MAX_LNG: num({ default: 180 }),

    H3_SIMULATOR_BBOX_MIN_LAT: num({ default: 37.7 }),
    H3_SIMULATOR_BBOX_MAX_LAT: num({ default: 37.82 }),
    H3_SIMULATOR_BBOX_MIN_LNG: num({ default: -122.52 }),
    H3_SIMULATOR_BBOX_MAX_LNG: num({ default: -122.35 }),
  });

  const postgresUrl = `postgres://${env.POSTGRES_USER}:${encodeURIComponent(
    env.POSTGRES_PASSWORD,
  )}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    postgres: {
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      url: postgresUrl,
    },
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    },
    quadtree: {
      leafCapacity: env.QUADTREE_LEAF_CAPACITY,
      bbox: {
        minLat: env.QUADTREE_BBOX_MIN_LAT,
        maxLat: env.QUADTREE_BBOX_MAX_LAT,
        minLng: env.QUADTREE_BBOX_MIN_LNG,
        maxLng: env.QUADTREE_BBOX_MAX_LNG,
      },
    },
    h3Simulator: {
      bbox: {
        minLat: env.H3_SIMULATOR_BBOX_MIN_LAT,
        maxLat: env.H3_SIMULATOR_BBOX_MAX_LAT,
        minLng: env.H3_SIMULATOR_BBOX_MIN_LNG,
        maxLng: env.H3_SIMULATOR_BBOX_MAX_LNG,
      },
    },
  };
}
