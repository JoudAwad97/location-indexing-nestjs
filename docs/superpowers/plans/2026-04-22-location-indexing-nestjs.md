# Location Indexing NestJS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade NestJS reference project implementing all six location-indexing approaches from the companion article (2D search, fixed grid, geohash, quadtree, S2, H3) — optimized for reader comprehension with a single `docker compose up` bring-up.

**Architecture:** Modular monolith NestJS app. One module per approach, identical folder shape across modules, shared `ProximityStrategy` interface. Postgres 16 + PostGIS 3.4 + h3-pg + Redis 7 as persistence. Synthetic seeder CLI generates deterministic test data. All six strategies share one `locations` table with denormalized index columns.

**Tech Stack:** NestJS 10, TypeScript 5 (strict), Postgres 16, PostGIS 3.4, `postgresql-16-h3` extension, Redis 7, `node-pg-migrate`, `ioredis`, `ngeohash`, `h3-js` v4, `@radarlabs/s2`, `envalid`, `pino`, `class-validator`, Swagger via `@nestjs/swagger`.

**Spec reference:** `docs/superpowers/specs/2026-04-22-location-indexing-nestjs-design.md`

**Testing posture:** Intentionally no tests (per spec §11, §13). Verification is manual via `npm run lint`, Swagger (`/api/docs`), curl examples, and log inspection.

**Repo root:** `/Users/joudawad/Desktop/location-indexing-nestjs/` — git initialized, spec already committed as the root commit.

---

## Table of Contents

**Phase 1 — Scaffolding**
- Task 1: NestJS app scaffold (`package.json`, `tsconfig`, `nest-cli`, bootstrap)
- Task 2: ESLint + Prettier + `.gitignore`
- Task 3: Custom Postgres Dockerfile (PostGIS + h3-pg)
- Task 4: `docker-compose.yml` + `.env.example`
- Task 5: Config module with `envalid` validation

**Phase 2 — Shared infra**
- Task 6: Pino logger + request-id middleware
- Task 7: Postgres client + `DatabaseModule` + `node-pg-migrate` wiring
- Task 8: Initial migration — `locations`, `geofences`, `geofence_cells`, `driver_pings`
- Task 9: `RedisModule` with `ioredis`
- Task 10: Shared contracts (`ProximityStrategy`, DTOs) + geo utils (haversine, bbox)

**Phase 3 — Seeder**
- Task 11: Seeder CLI + city-cluster / uniform / hotspot generators

**Phase 4 — Modules (in article order)**
- Task 12: `two-d-search/` module (naive + PostGIS engines)
- Task 13: `fixed-grid/` module
- Task 14: `geohash/` module (Redis + Postgres engines)
- Task 15: `quadtree/` module (in-memory + readiness)
- Task 16: `s2/` module (standard + geofencing)
- Task 17: `h3/` module (h3-js + h3-pg engines + driver simulator + SSE)

**Phase 5 — Polish**
- Task 18: Wire `AppModule` + Swagger at `/api/docs`
- Task 19: Top-level README with 5-minute tour
- Task 20: Per-module READMEs + `docs/architecture.md`

---

## Phase 1 — Scaffolding

### Task 1: NestJS app scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `nest-cli.json`
- Create: `src/main.ts`
- Create: `src/app.module.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "location-indexing-nestjs",
  "version": "0.1.0",
  "private": true,
  "description": "Production-grade NestJS reference for location indexing: 2D search, fixed grid, geohash, quadtree, S2, H3.",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"src/**/*.ts\"",
    "lint:fix": "eslint \"src/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "migrate": "node-pg-migrate up --config-file .pgmigraterc.json",
    "migrate:down": "node-pg-migrate down --config-file .pgmigraterc.json",
    "seed": "ts-node -r tsconfig-paths/register src/seeding/seed.command.ts",
    "db:shell": "docker compose exec postgres psql -U postgres -d location_indexing",
    "redis:cli": "docker compose exec redis redis-cli"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.10",
    "@nestjs/core": "^10.3.10",
    "@nestjs/platform-express": "^10.3.10",
    "@nestjs/swagger": "^7.4.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "envalid": "^8.0.0",
    "h3-js": "^4.1.0",
    "ioredis": "^5.4.1",
    "ngeohash": "^0.6.3",
    "nestjs-pino": "^4.1.0",
    "pg": "^8.12.0",
    "pino": "^9.2.0",
    "pino-http": "^10.2.0",
    "pino-pretty": "^11.2.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "seedrandom": "^3.0.5",
    "uuid": "^10.0.0",
    "@radarlabs/s2": "^1.0.5"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.2",
    "@nestjs/schematics": "^10.1.2",
    "@types/express": "^4.17.21",
    "@types/ngeohash": "^0.6.8",
    "@types/node": "^20.14.10",
    "@types/pg": "^8.11.6",
    "@types/seedrandom": "^3.0.8",
    "@types/uuid": "^10.0.0",
    "@typescript-eslint/eslint-plugin": "^7.16.1",
    "@typescript-eslint/parser": "^7.16.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "node-pg-migrate": "^7.5.2",
    "prettier": "^3.3.3",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.5.3"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Location Indexing NestJS')
    .setDescription(
      'Companion reference repo for the article on location indexing. Every module implements the same ProximityStrategy contract — compare 2D search, fixed grid, geohash, quadtree, S2, and H3 side by side.',
    )
    .setVersion('0.1.0')
    .build();

  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, doc);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 6: Create `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

Note: `AppModule` stays minimal here. Real imports (config, logger, database, Redis, feature modules) are added in Task 18.

- [ ] **Step 7: Install dependencies + typecheck**

Run:
```bash
npm install
npx tsc --noEmit
```
Expected: no type errors. `npm install` resolves cleanly.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json nest-cli.json src/main.ts src/app.module.ts
git commit -m "feat: NestJS app scaffold with TypeScript strict mode"
```

---

### Task 2: ESLint + Prettier + `.gitignore`

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.eslintignore`
- Create: `.prettierrc`
- Create: `.prettierignore`
- Create: `.gitignore`

- [ ] **Step 1: Create `.eslintrc.cjs`**

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'dist', 'node_modules'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
};
```

- [ ] **Step 2: Create `.eslintignore`**

```
dist
node_modules
coverage
*.js
```

- [ ] **Step 3: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 4: Create `.prettierignore`**

```
dist
node_modules
coverage
package-lock.json
```

- [ ] **Step 5: Create `.gitignore`**

```
# deps
node_modules/

# build
dist/
*.tsbuildinfo

# env
.env
.env.local
.env.*.local

# logs
*.log
npm-debug.log*

# ide
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# os
.DS_Store
Thumbs.db

# postgres volume mount (if ever bound to host)
postgres_data/
```

- [ ] **Step 6: Run lint to verify config**

Run: `npm run lint`
Expected: clean pass — `src/main.ts` and `src/app.module.ts` have no violations.

- [ ] **Step 7: Commit**

```bash
git add .eslintrc.cjs .eslintignore .prettierrc .prettierignore .gitignore
git commit -m "chore: ESLint + Prettier config, gitignore"
```

---

### Task 3: Custom Postgres Dockerfile (PostGIS + h3-pg)

**Files:**
- Create: `docker/postgres/Dockerfile`
- Create: `docker/postgres/init.sql`

- [ ] **Step 1: Create `docker/postgres/Dockerfile`**

```dockerfile
# Base image: PostGIS on Postgres 16
FROM postgis/postgis:16-3.4

# Install h3-pg: Uber H3 Postgres extension
# Package name: postgresql-16-h3 from PGDG repos (pre-configured on PostGIS image)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-16-h3 \
        postgresql-16-h3-postgis \
    && rm -rf /var/lib/apt/lists/*

# Init script enables extensions on DB creation
COPY init.sql /docker-entrypoint-initdb.d/10-extensions.sql
```

- [ ] **Step 2: Create `docker/postgres/init.sql`**

```sql
-- Enabled once at DB creation. Safe to re-run (IF NOT EXISTS).
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS h3;
CREATE EXTENSION IF NOT EXISTS h3_postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()
```

- [ ] **Step 3: Commit**

```bash
git add docker/postgres/Dockerfile docker/postgres/init.sql
git commit -m "feat: custom Postgres image with PostGIS + h3-pg extensions"
```

The image is not built yet — `docker compose build` happens in Task 4's verification step.

---

### Task 4: `docker-compose.yml` + `.env.example`

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    build:
      context: ./docker/postgres
      dockerfile: Dockerfile
    image: location-indexing-nestjs/postgres:16-3.4-h3
    container_name: location-indexing-postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-location_indexing}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    ports:
      - '${POSTGRES_PORT:-5432}:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-location_indexing}']
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: location-indexing-redis
    ports:
      - '${REDIS_PORT:-6379}:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

- [ ] **Step 2: Create `.env.example`**

```env
# App
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=location_indexing
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Quadtree
QUADTREE_LEAF_CAPACITY=100
QUADTREE_BBOX_MIN_LAT=-90
QUADTREE_BBOX_MAX_LAT=90
QUADTREE_BBOX_MIN_LNG=-180
QUADTREE_BBOX_MAX_LNG=180

# H3 simulator
H3_SIMULATOR_BBOX_MIN_LAT=37.70
H3_SIMULATOR_BBOX_MAX_LAT=37.82
H3_SIMULATOR_BBOX_MIN_LNG=-122.52
H3_SIMULATOR_BBOX_MAX_LNG=-122.35
```

- [ ] **Step 3: Create `.pgmigraterc.json`** (node-pg-migrate config)

```json
{
  "database-url-var": "DATABASE_URL",
  "migrations-dir": "src/shared/database/migrations",
  "migration-filename-format": "utc",
  "check-order": true,
  "verbose": true
}
```

- [ ] **Step 4: Build + start containers**

Run:
```bash
cp .env.example .env
docker compose build postgres
docker compose up -d
docker compose ps
```
Expected: both `location-indexing-postgres` and `location-indexing-redis` show `healthy` (may take ~20s after start).

- [ ] **Step 5: Smoke-test extensions**

Run:
```bash
docker compose exec postgres psql -U postgres -d location_indexing -c \
  "SELECT extname, extversion FROM pg_extension ORDER BY extname;"
```
Expected output includes rows for `h3`, `h3_postgis`, `pgcrypto`, `plpgsql`, `postgis`, `uuid-ossp`.

Run:
```bash
docker compose exec redis redis-cli ping
```
Expected: `PONG`

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example .pgmigraterc.json
git commit -m "feat: docker-compose with Postgres+PostGIS+h3-pg and Redis"
```

---

### Task 5: Config module with `envalid` validation

**Files:**
- Create: `src/shared/config/config.schema.ts`
- Create: `src/shared/config/config.service.ts`
- Create: `src/shared/config/config.module.ts`

- [ ] **Step 1: Create `src/shared/config/config.schema.ts`**

```typescript
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

    H3_SIMULATOR_BBOX_MIN_LAT: num({ default: 37.70 }),
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
```

- [ ] **Step 2: Create `src/shared/config/config.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AppConfig, loadConfig } from './config.schema';

@Injectable()
export class AppConfigService {
  private readonly config: AppConfig = loadConfig();

  get nodeEnv(): AppConfig['nodeEnv'] { return this.config.nodeEnv; }
  get port(): AppConfig['port'] { return this.config.port; }
  get logLevel(): AppConfig['logLevel'] { return this.config.logLevel; }
  get postgres(): AppConfig['postgres'] { return this.config.postgres; }
  get redis(): AppConfig['redis'] { return this.config.redis; }
  get quadtree(): AppConfig['quadtree'] { return this.config.quadtree; }
  get h3Simulator(): AppConfig['h3Simulator'] { return this.config.h3Simulator; }
}
```

- [ ] **Step 3: Create `src/shared/config/config.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './config.service';

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/config
git commit -m "feat: envalid-backed config module with fail-fast validation"
```

## Phase 2 — Shared infra

### Task 6: Pino logger + request-id middleware

**Files:**
- Create: `src/shared/logging/logger.module.ts`
- Create: `src/shared/logging/request-id.middleware.ts`

- [ ] **Step 1: Create `src/shared/logging/logger.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '../config/config.service';

@Global()
@Module({
  imports: [
    PinoModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        pinoHttp: {
          level: cfg.logLevel,
          transport:
            cfg.nodeEnv === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          genReqId: (req) => {
            const incoming = req.headers['x-request-id'];
            if (typeof incoming === 'string' && incoming.length > 0) return incoming;
            return randomUUID();
          },
          customProps: (req) => ({ requestId: req.id }),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
  ],
  exports: [PinoModule],
})
export class AppLoggerModule {}
```

- [ ] **Step 2: Create `src/shared/logging/request-id.middleware.ts`**

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id = (req as Request & { id?: string }).id;
    if (id) res.setHeader('x-request-id', id);
    next();
  }
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/logging
git commit -m "feat: pino logger with request-id correlation"
```

---

### Task 7: Postgres client + `DatabaseModule` + `node-pg-migrate` wiring

**Files:**
- Create: `src/shared/database/postgres.provider.ts`
- Create: `src/shared/database/database.module.ts`
- Create: `src/shared/database/tokens.ts`

- [ ] **Step 1: Create `src/shared/database/tokens.ts`**

```typescript
export const PG_POOL = Symbol('PG_POOL');
```

- [ ] **Step 2: Create `src/shared/database/postgres.provider.ts`**

```typescript
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
```

- [ ] **Step 3: Create `src/shared/database/database.module.ts`**

```typescript
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
```

- [ ] **Step 4: Update `.env.example` to add `DATABASE_URL`** (required by `node-pg-migrate`)

Append the following to `.env.example`:
```env

# Used by node-pg-migrate CLI
DATABASE_URL=postgres://postgres:postgres@localhost:5432/location_indexing
```

Then update your local `.env`:
```bash
echo "" >> .env
echo "DATABASE_URL=postgres://postgres:postgres@localhost:5432/location_indexing" >> .env
```

- [ ] **Step 5: Create migrations directory**

Run:
```bash
mkdir -p src/shared/database/migrations
touch src/shared/database/migrations/.gitkeep
```

- [ ] **Step 6: Smoke-test `migrate` command with empty migration set**

Run: `npm run migrate`
Expected: `No migrations to run!` (migrations dir empty — tool verifies it can connect + read the dir).

- [ ] **Step 7: Commit**

```bash
git add src/shared/database .env.example
git commit -m "feat: Postgres connection pool + DatabaseModule"
```

---

### Task 8: Initial migration — core tables

**Files:**
- Create: `src/shared/database/migrations/1700000000000_init-schema.sql`

- [ ] **Step 1: Generate migration stub**

Run:
```bash
npx node-pg-migrate create init-schema --config-file .pgmigraterc.json --migration-file-language sql
```
Note: this creates a file named like `<timestamp>_init-schema.sql`. Rename it to match the filename below if needed, or use the auto-generated name.

- [ ] **Step 2: Populate the migration file**

Open the generated file in `src/shared/database/migrations/` and replace its contents with:

```sql
-- Up Migration

CREATE TABLE locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,

  geohash_12    VARCHAR(12) NOT NULL,
  h3_r9         BIGINT       NOT NULL,
  s2_cell_l16   BIGINT       NOT NULL,
  grid_1km      BIGINT       NOT NULL,
  geog          GEOGRAPHY(POINT, 4326) NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lat_lng     ON locations (lat, lng);
CREATE INDEX idx_grid_1km    ON locations (grid_1km);
CREATE INDEX idx_geohash_12  ON locations (geohash_12 varchar_pattern_ops);
CREATE INDEX idx_h3_r9       ON locations (h3_r9);
CREATE INDEX idx_s2_l16      ON locations (s2_cell_l16);
CREATE INDEX idx_geog_gist   ON locations USING GIST (geog);

-- Geofencing (S2)
CREATE TABLE geofences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  polygon_geojson JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE geofence_cells (
  geofence_id   UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  s2_cell_id    BIGINT NOT NULL,
  level         SMALLINT NOT NULL,
  PRIMARY KEY (geofence_id, s2_cell_id)
);
CREATE INDEX idx_geofence_s2_cell ON geofence_cells (s2_cell_id);

-- H3 moving-object pings
CREATE TABLE driver_pings (
  driver_id   UUID NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  h3_r9       BIGINT NOT NULL,
  seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, seen_at)
);
CREATE INDEX idx_driver_pings_h3_recent ON driver_pings (h3_r9, seen_at DESC);

-- Trigger + NOTIFY for SSE stream
CREATE OR REPLACE FUNCTION notify_driver_ping() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'driver_pings_channel',
    json_build_object(
      'driver_id', NEW.driver_id,
      'lat', NEW.lat,
      'lng', NEW.lng,
      'h3_r9', NEW.h3_r9,
      'seen_at', NEW.seen_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_pings_notify
  AFTER INSERT ON driver_pings
  FOR EACH ROW EXECUTE FUNCTION notify_driver_ping();

-- Down Migration

DROP TRIGGER IF EXISTS driver_pings_notify ON driver_pings;
DROP FUNCTION IF EXISTS notify_driver_ping();
DROP TABLE IF EXISTS driver_pings;
DROP TABLE IF EXISTS geofence_cells;
DROP TABLE IF EXISTS geofences;
DROP TABLE IF EXISTS locations;
```

- [ ] **Step 3: Run the migration**

Run: `npm run migrate`
Expected: `Migrations complete!` followed by one migration applied.

- [ ] **Step 4: Verify schema**

Run:
```bash
npm run db:shell -- -c "\d locations" \
  && npm run db:shell -- -c "\d geofences" \
  && npm run db:shell -- -c "\d geofence_cells" \
  && npm run db:shell -- -c "\d driver_pings"
```
Expected: all four tables shown with the columns and indexes defined above.

- [ ] **Step 5: Commit**

```bash
git add src/shared/database/migrations
git commit -m "feat: initial schema — locations, geofences, driver_pings"
```

---

### Task 9: `RedisModule` with `ioredis`

**Files:**
- Create: `src/shared/redis/tokens.ts`
- Create: `src/shared/redis/redis.provider.ts`
- Create: `src/shared/redis/redis.module.ts`

- [ ] **Step 1: Create `src/shared/redis/tokens.ts`**

```typescript
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
```

- [ ] **Step 2: Create `src/shared/redis/redis.provider.ts`**

```typescript
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
    client.on('error', (err) => log.error(`Redis error: ${err.message}`));
    client.on('connect', () => log.log('Redis connected'));
    return client;
  },
};
```

- [ ] **Step 3: Create `src/shared/redis/redis.module.ts`**

```typescript
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
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/redis
git commit -m "feat: Redis module backed by ioredis"
```

---

### Task 10: Shared contracts + geo utils

**Files:**
- Create: `src/shared/contracts/location.types.ts`
- Create: `src/shared/contracts/proximity-strategy.interface.ts`
- Create: `src/shared/contracts/dto/location-input.dto.ts`
- Create: `src/shared/contracts/dto/nearby-query.dto.ts`
- Create: `src/shared/contracts/dto/nearby-result.dto.ts`
- Create: `src/shared/geo/haversine.ts`
- Create: `src/shared/geo/bbox.ts`
- Create: `src/shared/geo/constants.ts`

- [ ] **Step 1: Create `src/shared/contracts/location.types.ts`**

```typescript
export interface LocationInput {
  name: string;
  category: string;
  lat: number;
  lng: number;
}

export interface LocationRecord extends LocationInput {
  id: string;
  createdAt: Date;
}

export interface NearbyDiagnostics {
  cellsQueried: number;
  expansionSteps: number;
  dbRowsExamined?: number;
  latencyMs: number;
  notes?: Record<string, unknown>;
}

export interface NearbyResult {
  strategy: string;
  results: Array<LocationRecord & { distanceMeters: number }>;
  diagnostics: NearbyDiagnostics;
}
```

- [ ] **Step 2: Create `src/shared/contracts/proximity-strategy.interface.ts`**

```typescript
import { LocationInput, LocationRecord, NearbyResult } from './location.types';

export interface ProximityStrategy {
  readonly name: string;

  insert(loc: LocationInput): Promise<LocationRecord>;
  findById(id: string): Promise<LocationRecord | null>;
  findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
    minResults?: number;
  }): Promise<NearbyResult>;
}
```

- [ ] **Step 3: Create `src/shared/contracts/dto/location-input.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LocationInputDto {
  @ApiProperty({ example: 'Philz Coffee', description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'cafe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  category!: string;

  @ApiProperty({ example: 37.7749 })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -122.4194 })
  @IsLongitude()
  lng!: number;
}
```

- [ ] **Step 4: Create `src/shared/contracts/dto/nearby-query.dto.ts`**

```typescript
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, IsPositive, Max, Min } from 'class-validator';

export class NearbyQueryDto {
  @ApiProperty({ example: 37.7749 })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -122.4194 })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiProperty({ example: 1000, description: 'Radius in meters' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100_000)
  radiusMeters!: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ example: 10, description: 'Expand search if result count is below this' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minResults?: number;
}
```

- [ ] **Step 5: Create `src/shared/contracts/dto/nearby-result.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class NearbyResultItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty() lat!: number;
  @ApiProperty() lng!: number;
  @ApiProperty() distanceMeters!: number;
}

export class NearbyDiagnosticsDto {
  @ApiProperty() cellsQueried!: number;
  @ApiProperty() expansionSteps!: number;
  @ApiProperty({ required: false }) dbRowsExamined?: number;
  @ApiProperty() latencyMs!: number;
  @ApiProperty({ type: Object, required: false }) notes?: Record<string, unknown>;
}

export class NearbyResultDto {
  @ApiProperty() strategy!: string;
  @ApiProperty({ type: [NearbyResultItemDto] }) results!: NearbyResultItemDto[];
  @ApiProperty({ type: NearbyDiagnosticsDto }) diagnostics!: NearbyDiagnosticsDto;
}
```

- [ ] **Step 6: Create `src/shared/geo/constants.ts`**

```typescript
// Derived values used across modules — tested against article values.

/** Mean Earth radius in meters (WGS-84 authalic). */
export const EARTH_RADIUS_METERS = 6_371_000;

/** Meters in one degree of latitude (near-constant globally). */
export const METERS_PER_DEG_LAT = 111_320;
```

- [ ] **Step 7: Create `src/shared/geo/haversine.ts`**

```typescript
import { EARTH_RADIUS_METERS } from './constants';

/**
 * Great-circle distance between two lat/lng points, in meters.
 *
 * Haversine is accurate to well under 0.5% for distances up to a few thousand km —
 * more than sufficient for proximity search over city-scale radii.
 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lng - a.lng);

  const s =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(s));
}
```

- [ ] **Step 8: Create `src/shared/geo/bbox.ts`**

```typescript
import { METERS_PER_DEG_LAT } from './constants';

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Compute an axis-aligned bbox around a center point that fully contains
 * a circle of the given radius.
 *
 * Latitude: ~111.32 km/deg everywhere.
 * Longitude: shrinks with cos(lat) — reason 2D search "WHERE lng BETWEEN" breaks down.
 */
export function bboxAround(
  center: { lat: number; lng: number },
  radiusMeters: number,
): BoundingBox {
  const dLat = radiusMeters / METERS_PER_DEG_LAT;
  const phi = (center.lat * Math.PI) / 180;
  const dLng = radiusMeters / (METERS_PER_DEG_LAT * Math.cos(phi));

  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}
```

- [ ] **Step 9: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/shared/contracts src/shared/geo
git commit -m "feat: shared ProximityStrategy contract, DTOs, geo utils"
```

## Phase 3 — Seeder

### Task 11: Seeder CLI + generators

**Files:**
- Create: `src/seeding/generators/city-cluster.ts`
- Create: `src/seeding/generators/uniform.ts`
- Create: `src/seeding/generators/hotspot.ts`
- Create: `src/seeding/generators/generator.types.ts`
- Create: `src/seeding/populate-derived-columns.ts`
- Create: `src/seeding/seed.command.ts`

- [ ] **Step 1: Create `src/seeding/generators/generator.types.ts`**

```typescript
import seedrandom from 'seedrandom';

export type Rng = seedrandom.PRNG;

export interface GeneratedLocation {
  name: string;
  category: string;
  lat: number;
  lng: number;
}

export type Distribution = 'uniform' | 'city-cluster' | 'hotspot';

export interface GeneratorOptions {
  count: number;
  rng: Rng;
}

export type Generator = (opts: GeneratorOptions) => Iterable<GeneratedLocation>;
```

- [ ] **Step 2: Create `src/seeding/generators/uniform.ts`**

```typescript
import { GeneratedLocation, Generator } from './generator.types';

const CATEGORIES = ['restaurant', 'cafe', 'bar', 'store', 'park'] as const;

/** Uniformly distributed across the populated lat band and full lng range. */
export const uniformGenerator: Generator = function* ({ count, rng }): Iterable<GeneratedLocation> {
  for (let i = 0; i < count; i += 1) {
    const lat = rng() * 120 - 60; // -60..60 — where people actually live
    const lng = rng() * 360 - 180;
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!;
    yield {
      name: `Uniform POI ${i}`,
      category,
      lat,
      lng,
    };
  }
};
```

- [ ] **Step 3: Create `src/seeding/generators/city-cluster.ts`**

```typescript
import { GeneratedLocation, Generator } from './generator.types';

interface City {
  name: string;
  lat: number;
  lng: number;
  /** Cluster stddev in degrees — ~0.05 ≈ 5km */
  sigma: number;
  weight: number;
}

const CITIES: City[] = [
  { name: 'SF',     lat: 37.7749,  lng: -122.4194, sigma: 0.05, weight: 0.25 },
  { name: 'NYC',    lat: 40.7128,  lng:  -74.0060, sigma: 0.05, weight: 0.25 },
  { name: 'Tokyo',  lat: 35.6762,  lng:  139.6503, sigma: 0.05, weight: 0.20 },
  { name: 'Berlin', lat: 52.5200,  lng:   13.4050, sigma: 0.05, weight: 0.20 },
];

const CATEGORIES = ['restaurant', 'cafe', 'bar', 'store', 'park'] as const;

/** Box-Muller: turn two uniform samples into one Gaussian sample. */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function pickCity(rng: () => number): City | null {
  const r = rng();
  let acc = 0;
  for (const c of CITIES) {
    acc += c.weight;
    if (r <= acc) return c;
  }
  return null; // remaining weight → sparse fill
}

/**
 * City-cluster distribution:
 * - 90% of rows clustered around 4 major cities with Gaussian spread
 * - 10% sparse fill across populated lat band to exercise long-tail behaviour
 */
export const cityClusterGenerator: Generator = function* ({ count, rng }): Iterable<GeneratedLocation> {
  for (let i = 0; i < count; i += 1) {
    const city = pickCity(rng);
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!;

    if (city) {
      const lat = city.lat + gaussian(rng) * city.sigma;
      const lng = city.lng + gaussian(rng) * city.sigma;
      yield { name: `${city.name} POI ${i}`, category, lat, lng };
    } else {
      const lat = rng() * 120 - 60;
      const lng = rng() * 360 - 180;
      yield { name: `Sparse POI ${i}`, category, lat, lng };
    }
  }
};
```

- [ ] **Step 4: Create `src/seeding/generators/hotspot.ts`**

```typescript
import { GeneratedLocation, Generator } from './generator.types';

const CATEGORIES = ['restaurant', 'cafe', 'bar', 'store', 'park'] as const;

const SF = { lat: 37.7749, lng: -122.4194 };
const SIGMA = 0.03; // ~3km

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Tight cluster around SF for stress-testing dense-area behaviour. */
export const hotspotGenerator: Generator = function* ({ count, rng }): Iterable<GeneratedLocation> {
  for (let i = 0; i < count; i += 1) {
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)]!;
    yield {
      name: `SF Hotspot ${i}`,
      category,
      lat: SF.lat + gaussian(rng) * SIGMA,
      lng: SF.lng + gaussian(rng) * SIGMA,
    };
  }
};
```

- [ ] **Step 5: Create `src/seeding/populate-derived-columns.ts`**

```typescript
import ngeohash from 'ngeohash';
import { latLngToCell } from 'h3-js';
import S2 from '@radarlabs/s2';
import { GeneratedLocation } from './generators/generator.types';

export const GEOHASH_PRECISION = 12;
export const H3_RES_9 = 9;
export const S2_LEVEL_16 = 16;
export const FIXED_GRID_CELL_DEGREES = 0.009; // ≈ 1km at the equator

export interface DerivedRow {
  name: string;
  category: string;
  lat: number;
  lng: number;
  geohash_12: string;
  h3_r9: string;         // H3 JS returns string; stored as BIGINT via ::bigint cast
  s2_cell_l16: string;   // S2 cell ID as unsigned 64-bit string
  grid_1km: number;
}

/**
 * Derive all indexed columns from raw lat/lng.
 * Called once per row at seed time and during runtime INSERTs.
 */
export function deriveColumns(loc: GeneratedLocation): DerivedRow {
  const geohash_12 = ngeohash.encode(loc.lat, loc.lng, GEOHASH_PRECISION);
  const h3_r9 = latLngToCell(loc.lat, loc.lng, H3_RES_9);
  const s2_cell_l16 = S2.CellId.fromLatLng(new S2.LatLng(loc.lat, loc.lng))
    .parent(S2_LEVEL_16)
    .id()
    .toString();

  // Fixed-grid cell: coarse integer derived from degree-quantized lat/lng.
  // grid_w chosen so cell IDs stay in 53-bit safe-integer range.
  const gridW = Math.floor(360 / FIXED_GRID_CELL_DEGREES);
  const grid_1km =
    Math.floor((loc.lat + 90) / FIXED_GRID_CELL_DEGREES) * gridW +
    Math.floor((loc.lng + 180) / FIXED_GRID_CELL_DEGREES);

  return {
    name: loc.name,
    category: loc.category,
    lat: loc.lat,
    lng: loc.lng,
    geohash_12,
    h3_r9,
    s2_cell_l16,
    grid_1km,
  };
}
```

- [ ] **Step 6: Create `src/seeding/seed.command.ts`**

```typescript
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
```

- [ ] **Step 7: Seed 10k rows to verify end-to-end**

Run:
```bash
npm run migrate   # no-op if already up
npm run seed -- --count 10000 --distribution city-cluster --seed 42 --truncate
```
Expected: `Done. Inserted 10,000 rows in <N>s`.

- [ ] **Step 8: Sanity-check seeded data**

Run:
```bash
docker compose exec postgres psql -U postgres -d location_indexing -c \
  "SELECT count(*), min(lat), max(lat), min(lng), max(lng) FROM locations;"
```
Expected: `count=10000`, lat/lng ranges sensible (clustered around the 4 city centers).

Run:
```bash
docker compose exec redis redis-cli zcard geo:locations
```
Expected: `(integer) 10000`.

- [ ] **Step 9: Commit**

```bash
git add src/seeding
git commit -m "feat: synthetic seeder with city-cluster/uniform/hotspot generators"
```

## Phase 4 — Modules (in article order)

**Convention followed by every module in this phase:**

Each `modules/<approach>/` folder contains:
```
<approach>.module.ts
<approach>.controller.ts
<approach>.service.ts        # orchestration
<approach>.repository.ts     # DB / Redis / in-memory I/O
<approach>.strategy.ts       # implements ProximityStrategy
algorithm/*.ts               # pure, framework-free teaching code
README.md                    # filled in Task 20
```

Controllers expose the contract from the spec §4.2 + any strategy-specific extras from §4.3.

### Task 12: `two-d-search/` module (naive + PostGIS engines)

**Files:**
- Create: `src/modules/two-d-search/algorithm/bounding-box.ts`
- Create: `src/modules/two-d-search/two-d-search.repository.ts`
- Create: `src/modules/two-d-search/two-d-search.strategy.ts`
- Create: `src/modules/two-d-search/two-d-search.service.ts`
- Create: `src/modules/two-d-search/two-d-search.controller.ts`
- Create: `src/modules/two-d-search/two-d-search.module.ts`

- [ ] **Step 1: Create `algorithm/bounding-box.ts`**

```typescript
import { bboxAround } from '@/shared/geo/bbox';

/**
 * 2D naive search: expand the query point into an axis-aligned lat/lng bbox
 * and push the bounds into SQL.
 *
 * Teaching point: a composite B-tree on (lat, lng) can only range-seek on
 * the first column. The lng range becomes a row-level filter — that's why
 * `EXPLAIN ANALYZE` shows a Bitmap Heap Scan with heavy "Rows Removed by Filter".
 */
export function searchBoundingBox(
  center: { lat: number; lng: number },
  radiusMeters: number,
): ReturnType<typeof bboxAround> {
  return bboxAround(center, radiusMeters);
}
```

- [ ] **Step 2: Create `two-d-search.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { BoundingBox } from '@/shared/geo/bbox';

export type TwoDEngine = 'naive' | 'postgis';

interface RawRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  created_at: Date;
}

function mapRow(r: RawRow): LocationRecord {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
  };
}

@Injectable()
export class TwoDSearchRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const derived = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES
         ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [
        derived.name, derived.category, derived.lat, derived.lng,
        derived.geohash_12, derived.h3_r9, derived.s2_cell_l16, derived.grid_1km,
      ],
    );
    return mapRow(res.rows[0]!);
  }

  async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<RawRow>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async findNaive(
    bbox: BoundingBox,
    limit: number,
  ): Promise<{ rows: RawRow[]; planSummary: string }> {
    const client = await this.pool.connect();
    try {
      const planRes = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (FORMAT JSON)
           SELECT id, name, category, lat, lng, created_at
           FROM locations
           WHERE lat BETWEEN $1 AND $2
             AND lng BETWEEN $3 AND $4
           LIMIT $5`,
        [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng, limit],
      );
      const planSummary = JSON.stringify(planRes.rows[0], null, 2);

      const res = await client.query<RawRow>(
        `SELECT id, name, category, lat, lng, created_at
         FROM locations
         WHERE lat BETWEEN $1 AND $2
           AND lng BETWEEN $3 AND $4
         LIMIT $5`,
        [bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng, limit],
      );
      return { rows: res.rows, planSummary };
    } finally {
      client.release();
    }
  }

  async findPostgis(
    center: { lat: number; lng: number },
    radiusMeters: number,
    limit: number,
  ): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE ST_DWithin(
               geog,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )
       LIMIT $4`,
      [center.lat, center.lng, radiusMeters, limit],
    );
    return res.rows;
  }
}
```

- [ ] **Step 3: Create `two-d-search.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import {
  LocationInput, LocationRecord, NearbyResult,
} from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { searchBoundingBox } from './algorithm/bounding-box';
import { TwoDEngine, TwoDSearchRepository } from './two-d-search.repository';

@Injectable()
export class TwoDSearchStrategy implements ProximityStrategy {
  readonly name = 'two-d-search';

  constructor(private readonly repo: TwoDSearchRepository) {}

  insert(loc: LocationInput): Promise<LocationRecord> {
    return this.repo.insert(loc);
  }

  findById(id: string): Promise<LocationRecord | null> {
    return this.repo.findById(id);
  }

  async findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
    minResults?: number;
    engine?: TwoDEngine;
  }): Promise<NearbyResult> {
    const engine: TwoDEngine = q.engine ?? 'naive';
    const limit = q.limit ?? 50;
    const startedAt = Date.now();

    if (engine === 'naive') {
      const bbox = searchBoundingBox({ lat: q.lat, lng: q.lng }, q.radiusMeters);
      const { rows, planSummary } = await this.repo.findNaive(bbox, limit);
      const withDistance = rows
        .map((r) => ({
          ...{
            id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng,
            createdAt: r.created_at,
          },
          distanceMeters: haversineMeters({ lat: q.lat, lng: q.lng }, { lat: r.lat, lng: r.lng }),
        }))
        .filter((r) => r.distanceMeters <= q.radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      return {
        strategy: `${this.name}:naive`,
        results: withDistance,
        diagnostics: {
          cellsQueried: 1,
          expansionSteps: 0,
          latencyMs: Date.now() - startedAt,
          notes: { explainPlan: planSummary },
        },
      };
    }

    // postgis engine
    const rows = await this.repo.findPostgis({ lat: q.lat, lng: q.lng }, q.radiusMeters, limit);
    const withDistance = rows
      .map((r) => ({
        id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng,
        createdAt: r.created_at,
        distanceMeters: haversineMeters(
          { lat: q.lat, lng: q.lng },
          { lat: r.lat, lng: r.lng },
        ),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return {
      strategy: `${this.name}:postgis`,
      results: withDistance,
      diagnostics: {
        cellsQueried: 1,
        expansionSteps: 0,
        latencyMs: Date.now() - startedAt,
        notes: { indexUsed: 'idx_geog_gist (PostGIS GIST, sphere-aware)' },
      },
    };
  }
}
```

- [ ] **Step 4: Create `two-d-search.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { TwoDSearchStrategy } from './two-d-search.strategy';

@Injectable()
export class TwoDSearchService {
  constructor(public readonly strategy: TwoDSearchStrategy) {}
}
```

- [ ] **Step 5: Create `two-d-search.controller.ts`**

```typescript
import {
  Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { TwoDSearchService } from './two-d-search.service';
import { TwoDEngine } from './two-d-search.repository';

@ApiTags('2D Search')
@Controller('api/two-d-search/locations')
export class TwoDSearchController {
  constructor(private readonly svc: TwoDSearchService) {}

  @Post()
  insert(@Body() dto: LocationInputDto) {
    return this.svc.strategy.insert(dto);
  }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    const found = await this.svc.strategy.findById(id);
    if (!found) throw new NotFoundException();
    return found;
  }

  @Get('nearby')
  @ApiQuery({ name: 'engine', enum: ['naive', 'postgis'], required: false })
  findNearby(@Query() q: NearbyQueryDto, @Query('engine') engine?: TwoDEngine) {
    return this.svc.strategy.findNearby({ ...q, engine });
  }
}
```

- [ ] **Step 6: Create `two-d-search.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TwoDSearchController } from './two-d-search.controller';
import { TwoDSearchRepository } from './two-d-search.repository';
import { TwoDSearchService } from './two-d-search.service';
import { TwoDSearchStrategy } from './two-d-search.strategy';

@Module({
  controllers: [TwoDSearchController],
  providers: [TwoDSearchRepository, TwoDSearchStrategy, TwoDSearchService],
  exports: [TwoDSearchStrategy],
})
export class TwoDSearchModule {}
```

- [ ] **Step 7: Wire into `AppModule` temporarily** (fully wired in Task 18)

Edit `src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AppConfigModule } from './shared/config/config.module';
import { AppLoggerModule } from './shared/logging/logger.module';
import { DatabaseModule } from './shared/database/database.module';
import { RedisModule } from './shared/redis/redis.module';
import { TwoDSearchModule } from './modules/two-d-search/two-d-search.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    RedisModule,
    TwoDSearchModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 8: Start server + hit endpoint**

Run: `npm run start:dev`
Then in another terminal:
```bash
curl "http://localhost:3000/api/two-d-search/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"
```
Expected: JSON with `strategy: "two-d-search:naive"`, non-empty `results` (seed cluster around SF), and a `diagnostics.notes.explainPlan` payload showing a Bitmap Heap Scan.

Then:
```bash
curl "http://localhost:3000/api/two-d-search/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10&engine=postgis"
```
Expected: `strategy: "two-d-search:postgis"`, results match in same ballpark, diagnostics mentions GIST index.

- [ ] **Step 9: Commit**

```bash
git add src/modules/two-d-search src/app.module.ts
git commit -m "feat(two-d-search): naive + PostGIS engines with EXPLAIN diagnostics"
```

---

### Task 13: `fixed-grid/` module

**Files:**
- Create: `src/modules/fixed-grid/algorithm/cell-id.ts`
- Create: `src/modules/fixed-grid/algorithm/neighbors.ts`
- Create: `src/modules/fixed-grid/fixed-grid.repository.ts`
- Create: `src/modules/fixed-grid/fixed-grid.strategy.ts`
- Create: `src/modules/fixed-grid/fixed-grid.controller.ts`
- Create: `src/modules/fixed-grid/fixed-grid.module.ts`

- [ ] **Step 1: Create `algorithm/cell-id.ts`**

```typescript
import { FIXED_GRID_CELL_DEGREES } from '@/seeding/populate-derived-columns';

/**
 * Cell ID formula from the article:
 *
 *   cell_id = floor(lat / cellSize) * gridWidth + floor(lng / cellSize)
 *
 * We shift lat by +90 and lng by +180 so cell IDs are non-negative integers
 * that fit comfortably in a 53-bit JS number.
 */
export const CELL_SIZE_DEGREES = FIXED_GRID_CELL_DEGREES;
export const GRID_WIDTH = Math.floor(360 / CELL_SIZE_DEGREES);

export function cellIdOf(lat: number, lng: number): number {
  const latIdx = Math.floor((lat + 90) / CELL_SIZE_DEGREES);
  const lngIdx = Math.floor((lng + 180) / CELL_SIZE_DEGREES);
  return latIdx * GRID_WIDTH + lngIdx;
}

export function cellIndex(lat: number, lng: number): { latIdx: number; lngIdx: number } {
  return {
    latIdx: Math.floor((lat + 90) / CELL_SIZE_DEGREES),
    lngIdx: Math.floor((lng + 180) / CELL_SIZE_DEGREES),
  };
}
```

- [ ] **Step 2: Create `algorithm/neighbors.ts`**

```typescript
import { GRID_WIDTH, cellIndex } from './cell-id';

/**
 * Always return center cell + 8 neighbors.
 *
 * A query point near the edge of its cell has matching results in adjacent
 * cells. Omitting the neighbors is the canonical bug described in article §3.
 */
export function nineCellIds(lat: number, lng: number): number[] {
  const { latIdx, lngIdx } = cellIndex(lat, lng);
  const ids: number[] = [];
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      ids.push((latIdx + dLat) * GRID_WIDTH + (lngIdx + dLng));
    }
  }
  return ids;
}
```

- [ ] **Step 3: Create `fixed-grid.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';

interface RawRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  created_at: Date;
}

@Injectable()
export class FixedGridRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES
         ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [d.name, d.category, d.lat, d.lng, d.geohash_12, d.h3_r9, d.s2_cell_l16, d.grid_1km],
    );
    return {
      id: res.rows[0]!.id,
      name: res.rows[0]!.name,
      category: res.rows[0]!.category,
      lat: res.rows[0]!.lat,
      lng: res.rows[0]!.lng,
      createdAt: res.rows[0]!.created_at,
    };
  }

  async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<RawRow>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    const r = res.rows[0];
    return r
      ? { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at }
      : null;
  }

  async findByCells(cellIds: number[], limit: number): Promise<{ rows: RawRow[]; perCell: Record<string, number> }> {
    const res = await this.pool.query<RawRow & { grid_1km: string }>(
      `SELECT id, name, category, lat, lng, created_at, grid_1km::text AS grid_1km
       FROM locations
       WHERE grid_1km = ANY($1::bigint[])
       LIMIT $2`,
      [cellIds, limit],
    );

    const perCell: Record<string, number> = {};
    for (const row of res.rows) {
      perCell[row.grid_1km] = (perCell[row.grid_1km] ?? 0) + 1;
    }
    return { rows: res.rows, perCell };
  }
}
```

- [ ] **Step 4: Create `fixed-grid.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { nineCellIds } from './algorithm/neighbors';
import { FixedGridRepository } from './fixed-grid.repository';

@Injectable()
export class FixedGridStrategy implements ProximityStrategy {
  readonly name = 'fixed-grid';

  constructor(private readonly repo: FixedGridRepository) {}

  insert(loc: LocationInput): Promise<LocationRecord> {
    return this.repo.insert(loc);
  }
  findById(id: string): Promise<LocationRecord | null> {
    return this.repo.findById(id);
  }

  async findNearby(q: {
    lat: number; lng: number; radiusMeters: number; limit?: number;
  }): Promise<NearbyResult> {
    const startedAt = Date.now();
    const limit = q.limit ?? 50;
    const cellIds = nineCellIds(q.lat, q.lng);
    const { rows, perCell } = await this.repo.findByCells(cellIds, limit * 5);

    const withDistance = rows
      .map((r) => ({
        id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng,
        createdAt: r.created_at,
        distanceMeters: haversineMeters({ lat: q.lat, lng: q.lng }, { lat: r.lat, lng: r.lng }),
      }))
      .filter((r) => r.distanceMeters <= q.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return {
      strategy: this.name,
      results: withDistance,
      diagnostics: {
        cellsQueried: cellIds.length,
        expansionSteps: 0,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { perCellHits: perCell },
      },
    };
  }
}
```

- [ ] **Step 5: Create `fixed-grid.controller.ts`**

```typescript
import {
  Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { FixedGridStrategy } from './fixed-grid.strategy';

@ApiTags('Fixed Grid')
@Controller('api/fixed-grid/locations')
export class FixedGridController {
  constructor(private readonly strategy: FixedGridStrategy) {}

  @Post()
  insert(@Body() dto: LocationInputDto) { return this.strategy.insert(dto); }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }

  @Get('nearby')
  findNearby(@Query() q: NearbyQueryDto) { return this.strategy.findNearby(q); }
}
```

- [ ] **Step 6: Create `fixed-grid.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { FixedGridController } from './fixed-grid.controller';
import { FixedGridRepository } from './fixed-grid.repository';
import { FixedGridStrategy } from './fixed-grid.strategy';

@Module({
  controllers: [FixedGridController],
  providers: [FixedGridRepository, FixedGridStrategy],
  exports: [FixedGridStrategy],
})
export class FixedGridModule {}
```

- [ ] **Step 7: Wire into `AppModule` + start + curl**

Add `FixedGridModule` to `imports` in `src/app.module.ts`.

Run: `npm run start:dev`
```bash
curl "http://localhost:3000/api/fixed-grid/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"
```
Expected: results around SF, `diagnostics.cellsQueried = 9`, `notes.perCellHits` shows per-cell density distribution.

- [ ] **Step 8: Commit**

```bash
git add src/modules/fixed-grid src/app.module.ts
git commit -m "feat(fixed-grid): 9-cell proximity search with per-cell density diagnostics"
```

---

### Task 14: `geohash/` module (Redis + Postgres engines, dual-writer)

**Files:**
- Create: `src/modules/geohash/algorithm/precision.ts`
- Create: `src/modules/geohash/algorithm/neighbors.ts`
- Create: `src/modules/geohash/geohash.postgres.repository.ts`
- Create: `src/modules/geohash/geohash.redis.repository.ts`
- Create: `src/modules/geohash/geohash.strategy.ts`
- Create: `src/modules/geohash/geohash.controller.ts`
- Create: `src/modules/geohash/geohash.module.ts`

- [ ] **Step 1: Create `algorithm/precision.ts`**

```typescript
/**
 * Radius → geohash precision map from article §4.
 * Each precision-N geohash covers a rectangle of the size shown in the article's table.
 * Pick the precision whose cell *comfortably contains* the search radius.
 */
export function precisionForRadius(radiusMeters: number): number {
  if (radiusMeters <= 600) return 7;   // precision 7 ≈ 153m × 152m
  if (radiusMeters <= 5_000) return 6; // precision 6 ≈ 1.2km × 609m
  if (radiusMeters <= 20_000) return 5; // precision 5 ≈ 4.9km × 4.9km
  if (radiusMeters <= 100_000) return 4; // precision 4 ≈ 39km × 19km
  return 3;
}
```

- [ ] **Step 2: Create `algorithm/neighbors.ts`**

```typescript
import ngeohash from 'ngeohash';

/**
 * Article §4, "Boundary Issue 1": a query cell at the edge of its geohash region
 * misses neighbors on the other side of the boundary unless we always query
 * center + 8 neighbors.
 *
 * `ngeohash.neighbors(hash)` returns the 8 surrounding hashes in a fixed order.
 */
export function nineHashes(hash: string): string[] {
  return [hash, ...ngeohash.neighbors(hash)];
}
```

Note: the "remove a digit" expansion from article §4 is implemented inline inside `geohash.strategy.ts` (Step 6) — it's a short `while` loop that's easier to read next to the call sites than as a separate helper.

- [ ] **Step 3: Create `geohash.postgres.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';

interface RawRow {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  created_at: Date;
}

@Injectable()
export class GeohashPostgresRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES
         ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [d.name, d.category, d.lat, d.lng, d.geohash_12, d.h3_r9, d.s2_cell_l16, d.grid_1km],
    );
    const r = res.rows[0]!;
    return { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at };
  }

  async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<RawRow>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    const r = res.rows[0];
    return r
      ? { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at }
      : null;
  }

  /**
   * Query by prefix. `LIKE ANY` with `varchar_pattern_ops` index turns each
   * `prefix%` into a B-tree range scan on the geohash_12 column.
   */
  async findByPrefixes(prefixes: string[], limit: number): Promise<RawRow[]> {
    const patterns = prefixes.map((p) => `${p}%`);
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE geohash_12 LIKE ANY($1::text[])
       LIMIT $2`,
      [patterns, limit],
    );
    return res.rows;
  }
}
```

- [ ] **Step 4: Create `geohash.redis.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/shared/redis/tokens';

export const GEO_KEY = 'geo:locations';

export interface RedisGeoHit {
  member: string; // `${name}::${geohash_12}` as written by the seeder/dual-writer
  lng: number;
  lat: number;
  distanceMeters: number;
}

@Injectable()
export class GeohashRedisRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async upsert(loc: { name: string; lat: number; lng: number; geohash_12: string }): Promise<void> {
    await this.redis.geoadd(
      GEO_KEY,
      loc.lng,
      loc.lat,
      `${loc.name}::${loc.geohash_12}`,
    );
  }

  async searchByRadius(
    lat: number,
    lng: number,
    radiusMeters: number,
    limit: number,
  ): Promise<RedisGeoHit[]> {
    const raw = (await this.redis.call(
      'GEOSEARCH',
      GEO_KEY,
      'FROMLONLAT',
      String(lng),
      String(lat),
      'BYRADIUS',
      String(radiusMeters),
      'm',
      'ASC',
      'COUNT',
      String(limit),
      'WITHCOORD',
      'WITHDIST',
    )) as Array<[string, string, [string, string]]>;

    return raw.map(([member, distance, [mLng, mLat]]) => ({
      member,
      distanceMeters: Number(distance),
      lat: Number(mLat),
      lng: Number(mLng),
    }));
  }
}
```

- [ ] **Step 5: Create `geohash.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import ngeohash from 'ngeohash';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { nineHashes } from './algorithm/neighbors';
import { precisionForRadius } from './algorithm/precision';
import { GeohashPostgresRepository } from './geohash.postgres.repository';
import { GeohashRedisRepository } from './geohash.redis.repository';

export type GeohashEngine = 'postgres' | 'redis';

const MIN_PRECISION = 2;

@Injectable()
export class GeohashStrategy implements ProximityStrategy {
  readonly name = 'geohash';

  constructor(
    private readonly pg: GeohashPostgresRepository,
    private readonly redis: GeohashRedisRepository,
  ) {}

  /**
   * Dual-writer: Postgres is the system of record, Redis is the serving cache
   * for the `redis` engine. Postgres success is required; Redis failure logs
   * but does not fail the insert.
   */
  async insert(loc: LocationInput): Promise<LocationRecord> {
    const record = await this.pg.insert(loc);
    try {
      const { geohash_12 } = deriveColumns(loc);
      await this.redis.upsert({ name: record.name, lat: record.lat, lng: record.lng, geohash_12 });
    } catch (err) {
      // Best-effort mirror. Reseed to recover.
      console.error('[geohash] Redis mirror failed:', (err as Error).message);
    }
    return record;
  }

  findById(id: string): Promise<LocationRecord | null> {
    return this.pg.findById(id);
  }

  async findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
    minResults?: number;
    engine?: GeohashEngine;
  }): Promise<NearbyResult> {
    const engine: GeohashEngine = q.engine ?? 'postgres';
    const limit = q.limit ?? 50;
    const minResults = q.minResults ?? 0;
    const startedAt = Date.now();

    if (engine === 'redis') {
      const hits = await this.redis.searchByRadius(q.lat, q.lng, q.radiusMeters, limit);
      const results = hits.map((h) => ({
        id: h.member,           // Redis member doubles as id here
        name: h.member.split('::')[0] ?? h.member,
        category: '<redis-geo>',
        lat: h.lat,
        lng: h.lng,
        createdAt: new Date(),
        distanceMeters: h.distanceMeters,
      }));
      return {
        strategy: `${this.name}:redis`,
        results,
        diagnostics: {
          cellsQueried: 0,
          expansionSteps: 0,
          latencyMs: Date.now() - startedAt,
          notes: { engine: 'redis GEOSEARCH', command: 'FROMLONLAT BYRADIUS' },
        },
      };
    }

    // Postgres prefix engine with expand-on-underflow.
    let precision = precisionForRadius(q.radiusMeters);
    let expansionSteps = 0;
    let prefixes = nineHashes(ngeohash.encode(q.lat, q.lng, precision));
    let rows = await this.pg.findByPrefixes(prefixes, limit * 5);

    while (rows.length < minResults && precision > MIN_PRECISION) {
      precision -= 1;
      expansionSteps += 1;
      prefixes = nineHashes(ngeohash.encode(q.lat, q.lng, precision));
      rows = await this.pg.findByPrefixes(prefixes, limit * 5);
    }

    const mapped = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        createdAt: r.created_at,
        distanceMeters: haversineMeters(
          { lat: q.lat, lng: q.lng },
          { lat: r.lat, lng: r.lng },
        ),
      }))
      .filter((r) => r.distanceMeters <= q.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return {
      strategy: `${this.name}:postgres`,
      results: mapped,
      diagnostics: {
        cellsQueried: prefixes.length,
        expansionSteps,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { finalPrecision: precision, prefixes },
      },
    };
  }
}
```

- [ ] **Step 6: Create `geohash.controller.ts`**

```typescript
import {
  Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { GeohashEngine, GeohashStrategy } from './geohash.strategy';

@ApiTags('Geohash')
@Controller('api/geohash/locations')
export class GeohashController {
  constructor(private readonly strategy: GeohashStrategy) {}

  @Post()
  insert(@Body() dto: LocationInputDto) { return this.strategy.insert(dto); }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }

  @Get('nearby')
  @ApiQuery({ name: 'engine', enum: ['postgres', 'redis'], required: false })
  findNearby(@Query() q: NearbyQueryDto, @Query('engine') engine?: GeohashEngine) {
    return this.strategy.findNearby({ ...q, engine });
  }
}
```

- [ ] **Step 7: Create `geohash.module.ts`**

```typescript
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
```

- [ ] **Step 8: Wire + smoke-test**

Add `GeohashModule` to `AppModule.imports`. Run `npm run start:dev` in one terminal, then:
```bash
curl "http://localhost:3000/api/geohash/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"
curl "http://localhost:3000/api/geohash/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10&engine=redis"
```
Expected: both engines return the SF cluster. `postgres` diagnostics shows `prefixes` (9 hashes) and `finalPrecision`. `redis` diagnostics notes the `GEOSEARCH` command.

- [ ] **Step 9: Commit**

```bash
git add src/modules/geohash src/app.module.ts
git commit -m "feat(geohash): Postgres prefix + Redis GEOSEARCH engines with expand strategy"
```

---

### Task 15: `quadtree/` module (in-memory + readiness)

**Files:**
- Create: `src/modules/quadtree/algorithm/types.ts`
- Create: `src/modules/quadtree/algorithm/node.ts`
- Create: `src/modules/quadtree/algorithm/build.ts`
- Create: `src/modules/quadtree/algorithm/query.ts`
- Create: `src/modules/quadtree/quadtree.repository.ts`
- Create: `src/modules/quadtree/quadtree.service.ts`
- Create: `src/modules/quadtree/quadtree.strategy.ts`
- Create: `src/modules/quadtree/quadtree.controller.ts`
- Create: `src/modules/quadtree/quadtree.module.ts`

- [ ] **Step 1: Create `algorithm/types.ts`**

```typescript
export interface QtBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface QtItem {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  createdAt: Date;
}
```

- [ ] **Step 2: Create `algorithm/node.ts`**

```typescript
import { QtBounds, QtItem } from './types';

/**
 * A quadtree node. Each node owns a rectangular region. If it holds more than
 * `leafCapacity` items, it splits into four equal sub-quadrants (NW, NE, SW, SE)
 * and re-distributes its items into them. Internal nodes hold no items directly.
 *
 * Memory cost (from article §5):
 *   - Internal node: ~64 bytes (bbox + 4 child pointers)
 *   - Leaf node with capacity 100: ~832 bytes (bbox + up to 100 ids)
 */
export class QuadtreeNode {
  children: [QuadtreeNode, QuadtreeNode, QuadtreeNode, QuadtreeNode] | null = null;
  items: QtItem[] = [];

  constructor(readonly bounds: QtBounds) {}

  contains(lat: number, lng: number): boolean {
    return (
      lat >= this.bounds.minLat &&
      lat <= this.bounds.maxLat &&
      lng >= this.bounds.minLng &&
      lng <= this.bounds.maxLng
    );
  }

  subdivide(): void {
    const { minLat, maxLat, minLng, maxLng } = this.bounds;
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    this.children = [
      new QuadtreeNode({ minLat: midLat, maxLat, minLng, maxLng: midLng }),       // NW
      new QuadtreeNode({ minLat: midLat, maxLat, minLng: midLng, maxLng }),       // NE
      new QuadtreeNode({ minLat, maxLat: midLat, minLng, maxLng: midLng }),       // SW
      new QuadtreeNode({ minLat, maxLat: midLat, minLng: midLng, maxLng }),       // SE
    ];
  }

  intersects(bbox: QtBounds): boolean {
    return !(
      bbox.minLat > this.bounds.maxLat ||
      bbox.maxLat < this.bounds.minLat ||
      bbox.minLng > this.bounds.maxLng ||
      bbox.maxLng < this.bounds.minLng
    );
  }
}
```

- [ ] **Step 3: Create `algorithm/build.ts`**

```typescript
import { QuadtreeNode } from './node';
import { QtBounds, QtItem } from './types';

export interface BuildStats {
  itemCount: number;
  leafCount: number;
  internalCount: number;
  maxDepth: number;
  buildMs: number;
}

/**
 * Build a quadtree by streaming items and inserting one at a time.
 *
 * Article §5: recursive subdivide when a leaf exceeds `leafCapacity`.
 * We keep insert iterative to avoid deep JS call stacks on millions of items.
 */
export function buildQuadtree(
  rootBounds: QtBounds,
  items: Iterable<QtItem>,
  leafCapacity: number,
): { root: QuadtreeNode; stats: BuildStats } {
  const startedAt = Date.now();
  const root = new QuadtreeNode(rootBounds);
  let itemCount = 0;

  for (const item of items) {
    insertItem(root, item, leafCapacity);
    itemCount += 1;
  }

  const stats = summarize(root);
  return {
    root,
    stats: { ...stats, itemCount, buildMs: Date.now() - startedAt },
  };
}

function insertItem(root: QuadtreeNode, item: QtItem, leafCapacity: number): void {
  let node = root;
  while (true) {
    if (node.children) {
      const next = node.children.find((c) => c.contains(item.lat, item.lng));
      if (!next) return; // off-root — silently drop (shouldn't happen with world bounds)
      node = next;
      continue;
    }
    node.items.push(item);
    if (node.items.length > leafCapacity) {
      node.subdivide();
      const toRedistribute = node.items;
      node.items = [];
      for (const held of toRedistribute) {
        const target = node.children!.find((c) => c.contains(held.lat, held.lng));
        if (target) target.items.push(held);
      }
    }
    return;
  }
}

function summarize(root: QuadtreeNode): Omit<BuildStats, 'itemCount' | 'buildMs'> {
  let leafCount = 0;
  let internalCount = 0;
  let maxDepth = 0;

  const stack: Array<{ node: QuadtreeNode; depth: number }> = [{ node: root, depth: 0 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    maxDepth = Math.max(maxDepth, depth);
    if (node.children) {
      internalCount += 1;
      for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
    } else {
      leafCount += 1;
    }
  }
  return { leafCount, internalCount, maxDepth };
}
```

- [ ] **Step 4: Create `algorithm/query.ts`**

```typescript
import { haversineMeters } from '@/shared/geo/haversine';
import { QuadtreeNode } from './node';
import { QtBounds, QtItem } from './types';

export interface QueryStats {
  nodesVisited: number;
}

/**
 * Article §5 query algorithm:
 *   1) Traverse to the leaf containing the query point
 *   2) If not enough results, widen to the parent bbox and gather from siblings
 *
 * We implement the simpler equivalent: build a candidate bbox expanded from the
 * search radius, walk the tree collecting items whose leaf bounds intersect it,
 * then filter by haversine. This is O(k + results) where k is tree depth.
 */
export function queryRange(
  root: QuadtreeNode,
  center: { lat: number; lng: number },
  radiusMeters: number,
  bbox: QtBounds,
): { items: Array<QtItem & { distanceMeters: number }>; stats: QueryStats } {
  const out: Array<QtItem & { distanceMeters: number }> = [];
  let nodesVisited = 0;

  const stack: QuadtreeNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    nodesVisited += 1;
    if (!node.intersects(bbox)) continue;

    if (node.children) {
      for (const c of node.children) stack.push(c);
      continue;
    }

    for (const item of node.items) {
      const d = haversineMeters(center, { lat: item.lat, lng: item.lng });
      if (d <= radiusMeters) out.push({ ...item, distanceMeters: d });
    }
  }

  return { items: out, stats: { nodesVisited } };
}
```

- [ ] **Step 5: Create `quadtree.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { QtItem } from './algorithm/types';

const STREAM_BATCH = 10_000;

@Injectable()
export class QuadtreeRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<{
      id: string; name: string; category: string; lat: number; lng: number; created_at: Date;
    }>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES
         ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
          ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [d.name, d.category, d.lat, d.lng, d.geohash_12, d.h3_r9, d.s2_cell_l16, d.grid_1km],
    );
    const r = res.rows[0]!;
    return { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at };
  }

  async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<{
      id: string; name: string; category: string; lat: number; lng: number; created_at: Date;
    }>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    const r = res.rows[0];
    return r
      ? { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at }
      : null;
  }

  /** Stream every location in batches for quadtree build. */
  async *streamAll(): AsyncIterable<QtItem> {
    let offset = 0;
    while (true) {
      const res = await this.pool.query<{
        id: string; name: string; category: string; lat: number; lng: number; created_at: Date;
      }>(
        `SELECT id, name, category, lat, lng, created_at
         FROM locations
         ORDER BY id
         LIMIT $1 OFFSET $2`,
        [STREAM_BATCH, offset],
      );
      if (res.rows.length === 0) break;
      for (const r of res.rows) {
        yield {
          id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at,
        };
      }
      if (res.rows.length < STREAM_BATCH) break;
      offset += res.rows.length;
    }
  }
}
```

- [ ] **Step 6: Create `quadtree.service.ts`**

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '@/shared/config/config.service';
import { BuildStats, buildQuadtree } from './algorithm/build';
import { QuadtreeNode } from './algorithm/node';
import { QtBounds } from './algorithm/types';
import { QuadtreeRepository } from './quadtree.repository';

@Injectable()
export class QuadtreeService implements OnModuleInit {
  private readonly log = new Logger(QuadtreeService.name);
  private _root: QuadtreeNode | null = null;
  private _stats: BuildStats | null = null;
  private _ready = false;

  constructor(
    private readonly repo: QuadtreeRepository,
    private readonly cfg: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const bounds: QtBounds = this.cfg.quadtree.bbox;
    this.log.log('Streaming locations to build quadtree...');

    // Buffer the async iterable to feed a synchronous build.
    const items = [];
    for await (const item of this.repo.streamAll()) items.push(item);

    const { root, stats } = buildQuadtree(bounds, items, this.cfg.quadtree.leafCapacity);
    this._root = root;
    this._stats = stats;
    this._ready = true;
    this.log.log(
      `Quadtree ready: items=${stats.itemCount} leaves=${stats.leafCount} ` +
        `internal=${stats.internalCount} maxDepth=${stats.maxDepth} buildMs=${stats.buildMs}`,
    );
  }

  get ready(): boolean { return this._ready; }
  get stats(): BuildStats | null { return this._stats; }
  get root(): QuadtreeNode {
    if (!this._root) throw new Error('Quadtree not ready');
    return this._root;
  }
}
```

- [ ] **Step 7: Create `quadtree.strategy.ts`**

```typescript
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { bboxAround } from '@/shared/geo/bbox';
import { queryRange } from './algorithm/query';
import { QuadtreeRepository } from './quadtree.repository';
import { QuadtreeService } from './quadtree.service';

@Injectable()
export class QuadtreeStrategy implements ProximityStrategy {
  readonly name = 'quadtree';

  constructor(
    private readonly repo: QuadtreeRepository,
    private readonly tree: QuadtreeService,
  ) {}

  insert(loc: LocationInput): Promise<LocationRecord> {
    // The in-memory tree is read-only between rebuilds. Inserts go to Postgres;
    // they become visible in quadtree queries after the next restart (spec §7.4).
    return this.repo.insert(loc);
  }

  findById(id: string): Promise<LocationRecord | null> {
    return this.repo.findById(id);
  }

  async findNearby(q: {
    lat: number; lng: number; radiusMeters: number; limit?: number;
  }): Promise<NearbyResult> {
    if (!this.tree.ready) {
      throw new ServiceUnavailableException({
        message: 'Quadtree still building. Retry shortly.',
        retryAfterSeconds: 5,
      });
    }

    const startedAt = Date.now();
    const limit = q.limit ?? 50;
    const bbox = bboxAround({ lat: q.lat, lng: q.lng }, q.radiusMeters);
    const { items, stats } = queryRange(
      this.tree.root,
      { lat: q.lat, lng: q.lng },
      q.radiusMeters,
      bbox,
    );

    const results = items
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return {
      strategy: this.name,
      results: results.map((r) => ({
        id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng,
        createdAt: r.createdAt, distanceMeters: r.distanceMeters,
      })),
      diagnostics: {
        cellsQueried: stats.nodesVisited,
        expansionSteps: 0,
        latencyMs: Date.now() - startedAt,
        notes: this.tree.stats
          ? {
              treeItemCount: this.tree.stats.itemCount,
              treeLeafCount: this.tree.stats.leafCount,
              treeInternalCount: this.tree.stats.internalCount,
              treeMaxDepth: this.tree.stats.maxDepth,
            }
          : undefined,
      },
    };
  }
}
```

- [ ] **Step 8: Create `quadtree.controller.ts`**

```typescript
import {
  Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param,
  ParseUUIDPipe, Post, Query, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { QuadtreeService } from './quadtree.service';
import { QuadtreeStrategy } from './quadtree.strategy';

@ApiTags('Quadtree')
@Controller('api/quadtree')
export class QuadtreeController {
  constructor(
    private readonly strategy: QuadtreeStrategy,
    private readonly tree: QuadtreeService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  health(@Res({ passthrough: true }) res: Response) {
    if (!this.tree.ready) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).setHeader('Retry-After', '5');
      return { ready: false };
    }
    return { ready: true, stats: this.tree.stats };
  }

  @Post('locations')
  insert(@Body() dto: LocationInputDto) { return this.strategy.insert(dto); }

  @Get('locations/:id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }

  @Get('locations/nearby')
  findNearby(@Query() q: NearbyQueryDto) { return this.strategy.findNearby(q); }
}
```

- [ ] **Step 9: Create `quadtree.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { QuadtreeController } from './quadtree.controller';
import { QuadtreeRepository } from './quadtree.repository';
import { QuadtreeService } from './quadtree.service';
import { QuadtreeStrategy } from './quadtree.strategy';

@Module({
  controllers: [QuadtreeController],
  providers: [QuadtreeRepository, QuadtreeService, QuadtreeStrategy],
  exports: [QuadtreeStrategy, QuadtreeService],
})
export class QuadtreeModule {}
```

- [ ] **Step 10: Wire + smoke-test**

Add `QuadtreeModule` to `AppModule.imports`. Run `npm run start:dev`. Watch the log line:
```
Quadtree ready: items=10000 leaves=... internal=... maxDepth=... buildMs=...
```
Then:
```bash
curl "http://localhost:3000/api/quadtree/health"
curl "http://localhost:3000/api/quadtree/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"
```
Expected: `health` returns `ready: true` + stats. `nearby` returns SF cluster items, diagnostics includes `treeMaxDepth` + `nodesVisited`.

- [ ] **Step 11: Commit**

```bash
git add src/modules/quadtree src/app.module.ts
git commit -m "feat(quadtree): in-memory tree built on module init with readiness gate"
```

---

### Task 16: `s2/` module (standard proximity + geofencing)

**Files:**
- Create: `src/modules/s2/algorithm/cell.ts`
- Create: `src/modules/s2/algorithm/region-cover.ts`
- Create: `src/modules/s2/s2.repository.ts`
- Create: `src/modules/s2/s2.strategy.ts`
- Create: `src/modules/s2/dto/create-geofence.dto.ts`
- Create: `src/modules/s2/s2.controller.ts`
- Create: `src/modules/s2/s2.module.ts`

- [ ] **Step 1: Create `algorithm/cell.ts`**

```typescript
import S2 from '@radarlabs/s2';

export const S2_LEVEL_POINT = 16;

/** Convert (lat, lng) to the enclosing S2 cell at the given level. */
export function latLngToCellId(lat: number, lng: number, level: number): string {
  return S2.CellId.fromLatLng(new S2.LatLng(lat, lng)).parent(level).id().toString();
}

/** Return the 8 adjacent cells of the given cell at the same level. */
export function neighborsOf(cellIdStr: string): string[] {
  const cell = new S2.CellId(BigInt(cellIdStr));
  return cell.getAllNeighbors(cell.level()).map((c) => c.id().toString());
}
```

- [ ] **Step 2: Create `algorithm/region-cover.ts`**

```typescript
import S2 from '@radarlabs/s2';
import { BoundingBox } from '@/shared/geo/bbox';

export interface CoveringCell {
  cellId: string;
  level: number;
}

export interface RegionCoverOptions {
  minLevel: number;
  maxLevel: number;
  maxCells: number;
}

/**
 * Article §6: RegionCoverer returns a near-minimal set of cells at *varying* levels
 * that tile the region. This is the core primitive behind S2 geofencing.
 */
export function coverBoundingBox(bbox: BoundingBox, opts: RegionCoverOptions): CoveringCell[] {
  const ll = new S2.LatLngRect(
    new S2.LatLng(bbox.minLat, bbox.minLng),
    new S2.LatLng(bbox.maxLat, bbox.maxLng),
  );
  const coverer = new S2.RegionCoverer({
    min: opts.minLevel,
    max: opts.maxLevel,
    maxCells: opts.maxCells,
  });
  return coverer.getCoveringCells(ll).map((c) => ({
    cellId: c.id().toString(),
    level: c.level(),
  }));
}

/**
 * Cover a GeoJSON Polygon (ring[0] = outer boundary; holes ignored for simplicity).
 * Matches the primary geofencing use case in the article.
 */
export function coverPolygon(
  coordinates: number[][][],
  opts: RegionCoverOptions,
): CoveringCell[] {
  const [outer] = coordinates;
  if (!outer || outer.length < 4) throw new Error('Polygon must have >= 4 points');

  const loop = new S2.Loop(outer.map(([lng, lat]) => new S2.LatLng(lat, lng)));
  const polygon = new S2.Polygon([loop]);
  const coverer = new S2.RegionCoverer({
    min: opts.minLevel,
    max: opts.maxLevel,
    maxCells: opts.maxCells,
  });
  return coverer.getCoveringCells(polygon).map((c) => ({
    cellId: c.id().toString(),
    level: c.level(),
  }));
}
```

Note: `@radarlabs/s2` exposes the classes used above. If any binding name differs on install, adjust to the library's actual API — the conceptual pieces (`LatLng`, `LatLngRect`, `Loop`, `Polygon`, `RegionCoverer`) are stable across the ecosystem.

- [ ] **Step 3: Create `s2.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';
import { CoveringCell } from './algorithm/region-cover';

interface RawRow {
  id: string; name: string; category: string; lat: number; lng: number; created_at: Date;
}

@Injectable()
export class S2Repository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertLocation(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
               ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [d.name, d.category, d.lat, d.lng, d.geohash_12, d.h3_r9, d.s2_cell_l16, d.grid_1km],
    );
    const r = res.rows[0]!;
    return { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at };
  }

  async findLocationById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<RawRow>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    const r = res.rows[0];
    return r
      ? { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at }
      : null;
  }

  async findLocationsByCells(cellIdsBigint: string[], limit: number): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE s2_cell_l16 = ANY($1::bigint[])
       LIMIT $2`,
      [cellIdsBigint, limit],
    );
    return res.rows;
  }

  async createGeofence(
    name: string,
    polygonGeoJson: object,
    covering: CoveringCell[],
  ): Promise<{ id: string; cellCount: number; levels: number[] }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const gf = await client.query<{ id: string }>(
        `INSERT INTO geofences (name, polygon_geojson) VALUES ($1, $2::jsonb) RETURNING id`,
        [name, JSON.stringify(polygonGeoJson)],
      );
      const id = gf.rows[0]!.id;

      if (covering.length > 0) {
        const placeholders = covering
          .map((_, i) => `($1, $${i * 2 + 2}::bigint, $${i * 2 + 3}::smallint)`)
          .join(', ');
        const params: (string | number)[] = [id];
        for (const c of covering) { params.push(c.cellId, c.level); }
        await client.query(
          `INSERT INTO geofence_cells (geofence_id, s2_cell_id, level) VALUES ${placeholders}`,
          params,
        );
      }

      await client.query('COMMIT');
      const levels = Array.from(new Set(covering.map((c) => c.level))).sort((a, b) => a - b);
      return { id, cellCount: covering.length, levels };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async distinctGeofenceLevels(): Promise<number[]> {
    const res = await this.pool.query<{ level: number }>(
      'SELECT DISTINCT level FROM geofence_cells ORDER BY level',
    );
    return res.rows.map((r) => r.level);
  }

  async matchGeofences(candidateCellIds: string[]): Promise<string[]> {
    if (candidateCellIds.length === 0) return [];
    const res = await this.pool.query<{ geofence_id: string }>(
      `SELECT DISTINCT geofence_id
       FROM geofence_cells
       WHERE s2_cell_id = ANY($1::bigint[])`,
      [candidateCellIds],
    );
    return res.rows.map((r) => r.geofence_id);
  }
}
```

- [ ] **Step 4: Create `s2.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { bboxAround } from '@/shared/geo/bbox';
import { haversineMeters } from '@/shared/geo/haversine';
import { S2_LEVEL_POINT, latLngToCellId } from './algorithm/cell';
import { coverBoundingBox, coverPolygon, CoveringCell } from './algorithm/region-cover';
import { S2Repository } from './s2.repository';

@Injectable()
export class S2Strategy implements ProximityStrategy {
  readonly name = 's2';

  constructor(private readonly repo: S2Repository) {}

  insert(loc: LocationInput): Promise<LocationRecord> {
    return this.repo.insertLocation(loc);
  }
  findById(id: string): Promise<LocationRecord | null> {
    return this.repo.findLocationById(id);
  }

  async findNearby(q: {
    lat: number; lng: number; radiusMeters: number; limit?: number;
  }): Promise<NearbyResult> {
    const startedAt = Date.now();
    const limit = q.limit ?? 50;

    const bbox = bboxAround({ lat: q.lat, lng: q.lng }, q.radiusMeters);
    const covering = coverBoundingBox(bbox, {
      minLevel: S2_LEVEL_POINT,
      maxLevel: S2_LEVEL_POINT,
      maxCells: 64,
    });
    const cellIds = covering.map((c) => c.cellId);

    const rows = await this.repo.findLocationsByCells(cellIds, limit * 5);
    const mapped = rows
      .map((r) => ({
        id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng,
        createdAt: r.created_at,
        distanceMeters: haversineMeters(
          { lat: q.lat, lng: q.lng },
          { lat: r.lat, lng: r.lng },
        ),
      }))
      .filter((r) => r.distanceMeters <= q.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return {
      strategy: this.name,
      results: mapped,
      diagnostics: {
        cellsQueried: cellIds.length,
        expansionSteps: 0,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { level: S2_LEVEL_POINT },
      },
    };
  }

  async createGeofence(input: {
    name: string;
    polygon: { type: 'Polygon'; coordinates: number[][][] };
  }): Promise<{ id: string; cellCount: number; levels: number[]; coveringSample: CoveringCell[] }> {
    const covering = coverPolygon(input.polygon.coordinates, {
      minLevel: 10,
      maxLevel: 16,
      maxCells: 64,
    });
    const created = await this.repo.createGeofence(input.name, input.polygon, covering);
    return { ...created, coveringSample: covering.slice(0, 10) };
  }

  async matchPoint(lat: number, lng: number): Promise<{
    matches: string[];
    candidatesChecked: number;
    levels: number[];
  }> {
    const levels = await this.repo.distinctGeofenceLevels();
    const candidates = levels.map((lv) => latLngToCellId(lat, lng, lv));
    const matches = await this.repo.matchGeofences(candidates);
    return { matches, candidatesChecked: candidates.length, levels };
  }
}
```

- [ ] **Step 5: Create `dto/create-geofence.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateNested, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class GeoJsonPolygonDto {
  @ApiProperty({ example: 'Polygon' })
  @IsString()
  @IsIn(['Polygon'])
  type!: 'Polygon';

  @ApiProperty({
    example: [
      [
        [-122.43, 37.77],
        [-122.41, 37.77],
        [-122.41, 37.79],
        [-122.43, 37.79],
        [-122.43, 37.77],
      ],
    ],
    description: 'GeoJSON ring(s). coordinates[0] is the outer ring, first = last.',
  })
  @IsArray()
  coordinates!: number[][][];
}

export class CreateGeofenceDto {
  @ApiProperty({ example: 'Downtown SF delivery zone' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ type: GeoJsonPolygonDto })
  @ValidateNested()
  @Type(() => GeoJsonPolygonDto)
  polygon!: GeoJsonPolygonDto;
}
```

- [ ] **Step 6: Create `s2.controller.ts`**

```typescript
import {
  Body, Controller, Get, NotFoundException, Param, ParseFloatPipe, ParseUUIDPipe,
  Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { CreateGeofenceDto } from './dto/create-geofence.dto';
import { S2Strategy } from './s2.strategy';

@ApiTags('S2')
@Controller('api/s2')
export class S2Controller {
  constructor(private readonly strategy: S2Strategy) {}

  @Post('locations')
  insert(@Body() dto: LocationInputDto) { return this.strategy.insert(dto); }

  @Get('locations/:id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }

  @Get('locations/nearby')
  findNearby(@Query() q: NearbyQueryDto) { return this.strategy.findNearby(q); }

  @Post('geofences')
  createGeofence(@Body() dto: CreateGeofenceDto) {
    return this.strategy.createGeofence(dto);
  }

  @Get('geofences/match')
  matchGeofences(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
  ) {
    return this.strategy.matchPoint(lat, lng);
  }
}
```

- [ ] **Step 7: Create `s2.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { S2Controller } from './s2.controller';
import { S2Repository } from './s2.repository';
import { S2Strategy } from './s2.strategy';

@Module({
  controllers: [S2Controller],
  providers: [S2Repository, S2Strategy],
  exports: [S2Strategy],
})
export class S2Module {}
```

- [ ] **Step 8: Wire + smoke-test**

Add `S2Module` to `AppModule.imports`. Run `npm run start:dev`. Then:
```bash
# proximity
curl "http://localhost:3000/api/s2/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"

# geofence
curl -X POST "http://localhost:3000/api/s2/geofences" -H "Content-Type: application/json" -d '{
  "name": "Downtown SF",
  "polygon": {
    "type": "Polygon",
    "coordinates": [[
      [-122.43, 37.77],
      [-122.41, 37.77],
      [-122.41, 37.79],
      [-122.43, 37.79],
      [-122.43, 37.77]
    ]]
  }
}'

# match inside the zone
curl "http://localhost:3000/api/s2/geofences/match?lat=37.78&lng=-122.42"

# match outside the zone
curl "http://localhost:3000/api/s2/geofences/match?lat=40.7128&lng=-74.0060"
```
Expected: proximity returns SF cluster. Geofence create returns `cellCount` and `levels`. Inside-zone match returns the new geofence id; outside-zone match returns empty.

- [ ] **Step 9: Commit**

```bash
git add src/modules/s2 src/app.module.ts
git commit -m "feat(s2): covering-cell proximity + geofencing with mixed-level RegionCover"
```

---

### Task 17: `h3/` module (h3-js + h3-pg engines + driver simulator + SSE)

**Files:**
- Create: `src/modules/h3/algorithm/cell.ts`
- Create: `src/modules/h3/algorithm/expand.ts`
- Create: `src/modules/h3/h3.repository.ts`
- Create: `src/modules/h3/h3.strategy.ts`
- Create: `src/modules/h3/drivers/driver-pings.repository.ts`
- Create: `src/modules/h3/drivers/drivers.simulator.ts`
- Create: `src/modules/h3/drivers/drivers.listener.ts`
- Create: `src/modules/h3/drivers/dto/simulator-control.dto.ts`
- Create: `src/modules/h3/drivers/drivers.controller.ts`
- Create: `src/modules/h3/h3.controller.ts`
- Create: `src/modules/h3/h3.module.ts`

- [ ] **Step 1: Create `algorithm/cell.ts`**

```typescript
import { latLngToCell, cellToLatLng, gridDisk, gridRingUnsafe } from 'h3-js';

export const H3_RES_POINT = 9; // ~0.1km² — one row per ~100m × 100m area

export function encodeCell(lat: number, lng: number, res = H3_RES_POINT): string {
  return latLngToCell(lat, lng, res);
}

export function cellCenter(cell: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/** `gridDisk(center, k)` = filled disk of all cells within k steps (article §7). */
export function diskCells(center: string, k: number): string[] {
  return gridDisk(center, k);
}

/** Hollow ring at exactly k steps — used by demand-forecasting examples in article §7. */
export function ringCells(center: string, k: number): string[] {
  return gridRingUnsafe(center, k);
}
```

- [ ] **Step 2: Create `algorithm/expand.ts`**

```typescript
/**
 * Article §7 expand loop: if result count < minResults, widen the disk by one step.
 *
 * Formula for disk size at k: 3k(k+1)+1. So k=1 → 7 cells, k=2 → 19, k=3 → 37.
 * Stopping at max k prevents unbounded widening in sparse areas.
 */
export function initialKForRadius(radiusMeters: number, edgeMeters: number): number {
  if (radiusMeters <= edgeMeters) return 1;
  return Math.max(1, Math.ceil(radiusMeters / edgeMeters));
}

export const MAX_K = 10; // disk of 331 cells
```

- [ ] **Step 3: Create `h3.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { LocationInput, LocationRecord } from '@/shared/contracts/location.types';
import { deriveColumns } from '@/seeding/populate-derived-columns';

export type H3Engine = 'h3-js' | 'h3-pg';

interface RawRow {
  id: string; name: string; category: string; lat: number; lng: number; created_at: Date;
}

@Injectable()
export class H3Repository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insert(loc: LocationInput): Promise<LocationRecord> {
    const d = deriveColumns(loc);
    const res = await this.pool.query<RawRow>(
      `INSERT INTO locations
         (name, category, lat, lng, geohash_12, h3_r9, s2_cell_l16, grid_1km, geog)
       VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, $8::bigint,
               ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography)
       RETURNING id, name, category, lat, lng, created_at`,
      [d.name, d.category, d.lat, d.lng, d.geohash_12, d.h3_r9, d.s2_cell_l16, d.grid_1km],
    );
    const r = res.rows[0]!;
    return { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at };
  }

  async findById(id: string): Promise<LocationRecord | null> {
    const res = await this.pool.query<RawRow>(
      'SELECT id, name, category, lat, lng, created_at FROM locations WHERE id = $1',
      [id],
    );
    const r = res.rows[0];
    return r
      ? { id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng, createdAt: r.created_at }
      : null;
  }

  /**
   * h3-js engine: cells were computed in app, passed in as a bigint array.
   */
  async findByCells_jsEngine(cellIdsBigint: string[], limit: number): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `SELECT id, name, category, lat, lng, created_at
       FROM locations
       WHERE h3_r9 = ANY($1::bigint[])
       LIMIT $2`,
      [cellIdsBigint, limit],
    );
    return res.rows;
  }

  /**
   * h3-pg engine: uses the Postgres extension to compute the disk in SQL.
   * The `::h3index` cast + `h3_grid_disk` are exposed by the extension.
   */
  async findByCells_pgEngine(centerCellBigint: string, k: number, limit: number): Promise<RawRow[]> {
    const res = await this.pool.query<RawRow>(
      `WITH disk AS (
         SELECT h3_grid_disk($1::bigint::h3index, $2::integer) AS cells
       )
       SELECT l.id, l.name, l.category, l.lat, l.lng, l.created_at
       FROM locations l, disk
       WHERE l.h3_r9::h3index = ANY(disk.cells)
       LIMIT $3`,
      [centerCellBigint, k, limit],
    );
    return res.rows;
  }
}
```

- [ ] **Step 4: Create `h3.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { getHexagonEdgeLengthAvg, UNITS } from 'h3-js';
import { ProximityStrategy } from '@/shared/contracts/proximity-strategy.interface';
import { LocationInput, LocationRecord, NearbyResult } from '@/shared/contracts/location.types';
import { haversineMeters } from '@/shared/geo/haversine';
import { H3_RES_POINT, diskCells, encodeCell } from './algorithm/cell';
import { MAX_K, initialKForRadius } from './algorithm/expand';
import { H3Engine, H3Repository } from './h3.repository';

@Injectable()
export class H3Strategy implements ProximityStrategy {
  readonly name = 'h3';

  constructor(private readonly repo: H3Repository) {}

  insert(loc: LocationInput): Promise<LocationRecord> { return this.repo.insert(loc); }
  findById(id: string): Promise<LocationRecord | null> { return this.repo.findById(id); }

  async findNearby(q: {
    lat: number;
    lng: number;
    radiusMeters: number;
    limit?: number;
    minResults?: number;
    engine?: H3Engine;
  }): Promise<NearbyResult> {
    const engine: H3Engine = q.engine ?? 'h3-js';
    const limit = q.limit ?? 50;
    const minResults = q.minResults ?? 0;
    const startedAt = Date.now();

    const center = encodeCell(q.lat, q.lng, H3_RES_POINT);
    // Average hex edge length at resolution 9 ≈ 174m.
    const edgeMeters = getHexagonEdgeLengthAvg(H3_RES_POINT, UNITS.m);
    let k = initialKForRadius(q.radiusMeters, edgeMeters);
    let expansionSteps = 0;
    let rows: Awaited<ReturnType<typeof this.repo.findByCells_jsEngine>> = [];
    let lastCellCount = 0;

    while (true) {
      if (engine === 'h3-js') {
        const cells = diskCells(center, k);
        lastCellCount = cells.length;
        // h3-js returns cell ids as hex strings; cast via h3_string_to_int is cleaner,
        // but the h3-js ids are already BigInt-compatible when parsed in Postgres.
        // We store h3_r9 as BIGINT. To compare, convert to decimal string:
        const cellsAsBigint = cells.map((c) => BigInt(`0x${c}`).toString());
        rows = await this.repo.findByCells_jsEngine(cellsAsBigint, limit * 5);
      } else {
        const centerBigint = BigInt(`0x${center}`).toString();
        rows = await this.repo.findByCells_pgEngine(centerBigint, k, limit * 5);
        lastCellCount = 3 * k * (k + 1) + 1;
      }

      if (rows.length >= minResults || k >= MAX_K) break;
      k += 1;
      expansionSteps += 1;
    }

    const mapped = rows
      .map((r) => ({
        id: r.id, name: r.name, category: r.category, lat: r.lat, lng: r.lng,
        createdAt: r.created_at,
        distanceMeters: haversineMeters(
          { lat: q.lat, lng: q.lng },
          { lat: r.lat, lng: r.lng },
        ),
      }))
      .filter((r) => r.distanceMeters <= q.radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return {
      strategy: `${this.name}:${engine}`,
      results: mapped,
      diagnostics: {
        cellsQueried: lastCellCount,
        expansionSteps,
        dbRowsExamined: rows.length,
        latencyMs: Date.now() - startedAt,
        notes: { resolution: H3_RES_POINT, k },
      },
    };
  }
}
```

- [ ] **Step 5: Create `drivers/driver-pings.repository.ts`**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '@/shared/database/tokens';
import { encodeCell } from '../algorithm/cell';

export interface DriverPing {
  driver_id: string;
  lat: number;
  lng: number;
  h3_r9: string;
  seen_at: Date;
}

@Injectable()
export class DriverPingsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async upsertPing(input: { driverId: string; lat: number; lng: number }): Promise<void> {
    const cell = encodeCell(input.lat, input.lng);
    const cellBigint = BigInt(`0x${cell}`).toString();
    await this.pool.query(
      `INSERT INTO driver_pings (driver_id, lat, lng, h3_r9)
       VALUES ($1, $2, $3, $4::bigint)`,
      [input.driverId, input.lat, input.lng, cellBigint],
    );
  }

  async latestPingsNearCells(
    cellIdsBigint: string[],
    limit: number,
  ): Promise<DriverPing[]> {
    // For each driver, take the latest ping whose h3_r9 is in the target set.
    const res = await this.pool.query<DriverPing>(
      `SELECT DISTINCT ON (driver_id)
         driver_id, lat, lng, h3_r9::text AS h3_r9, seen_at
       FROM driver_pings
       WHERE h3_r9 = ANY($1::bigint[])
       ORDER BY driver_id, seen_at DESC
       LIMIT $2`,
      [cellIdsBigint, limit],
    );
    return res.rows;
  }
}
```

- [ ] **Step 6: Create `drivers/drivers.simulator.ts`**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppConfigService } from '@/shared/config/config.service';
import { DriverPingsRepository } from './driver-pings.repository';

interface Driver { id: string; lat: number; lng: number; }

@Injectable()
export class DriversSimulator {
  private readonly log = new Logger(DriversSimulator.name);
  private drivers: Driver[] = [];
  private handle: NodeJS.Timeout | null = null;

  constructor(
    private readonly repo: DriverPingsRepository,
    private readonly cfg: AppConfigService,
  ) {}

  isRunning(): boolean { return this.handle !== null; }
  driverCount(): number { return this.drivers.length; }

  start(count: number, intervalMs: number): void {
    if (this.handle) this.stop();
    const { minLat, maxLat, minLng, maxLng } = this.cfg.h3Simulator.bbox;
    this.drivers = Array.from({ length: count }, () => ({
      id: randomUUID(),
      lat: randomInRange(minLat, maxLat),
      lng: randomInRange(minLng, maxLng),
    }));
    this.log.log(`Simulator starting: drivers=${count} intervalMs=${intervalMs}`);
    this.handle = setInterval(() => void this.tick(), intervalMs);
  }

  stop(): void {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = null;
      this.log.log('Simulator stopped');
    }
  }

  private async tick(): Promise<void> {
    const stepDeg = 0.0005; // ~55m
    const { minLat, maxLat, minLng, maxLng } = this.cfg.h3Simulator.bbox;
    for (const d of this.drivers) {
      d.lat = clamp(d.lat + (Math.random() - 0.5) * stepDeg, minLat, maxLat);
      d.lng = clamp(d.lng + (Math.random() - 0.5) * stepDeg, minLng, maxLng);
      try {
        await this.repo.upsertPing({ driverId: d.id, lat: d.lat, lng: d.lng });
      } catch (err) {
        this.log.warn(`ping insert failed: ${(err as Error).message}`);
      }
    }
  }
}

function randomInRange(a: number, b: number): number { return a + (b - a) * Math.random(); }
function clamp(x: number, a: number, b: number): number { return Math.min(Math.max(x, a), b); }
```

- [ ] **Step 7: Create `drivers/drivers.listener.ts`**

```typescript
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { EventEmitter } from 'node:events';
import { AppConfigService } from '@/shared/config/config.service';

export interface PingEvent {
  driver_id: string;
  lat: number;
  lng: number;
  h3_r9: string;
  seen_at: string;
}

@Injectable()
export class DriversListener
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly log = new Logger(DriversListener.name);
  private client: Client | null = null;

  constructor(private readonly cfg: AppConfigService) { super(); }

  async onModuleInit(): Promise<void> {
    // Dedicated Client — can't use the shared Pool because LISTEN is stateful.
    this.client = new Client({
      host: this.cfg.postgres.host,
      port: this.cfg.postgres.port,
      database: this.cfg.postgres.database,
      user: this.cfg.postgres.user,
      password: this.cfg.postgres.password,
    });
    await this.client.connect();
    this.client.on('notification', (msg) => {
      if (msg.channel !== 'driver_pings_channel' || !msg.payload) return;
      try {
        const evt = JSON.parse(msg.payload) as PingEvent;
        this.emit('ping', evt);
      } catch (err) {
        this.log.warn(`parse failed: ${(err as Error).message}`);
      }
    });
    await this.client.query('LISTEN driver_pings_channel');
    this.log.log('Listening on driver_pings_channel');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.query('UNLISTEN driver_pings_channel').catch(() => undefined);
      await this.client.end();
    }
  }
}
```

- [ ] **Step 8: Create `drivers/dto/simulator-control.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SimulatorControlDto {
  @ApiProperty({ enum: ['start', 'stop'] })
  @IsIn(['start', 'stop'])
  action!: 'start' | 'stop';

  @ApiProperty({ example: 50, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  count?: number;

  @ApiProperty({ example: 1000, required: false, description: 'Tick interval in ms' })
  @IsOptional()
  @IsInt()
  @Min(250)
  @Max(60_000)
  intervalMs?: number;
}
```

- [ ] **Step 9: Create `drivers/drivers.controller.ts`**

```typescript
import {
  Body, Controller, Get, ParseFloatPipe, ParseIntPipe, Post, Query, Res, Sse,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Observable, fromEvent, map } from 'rxjs';
import { diskCells, encodeCell } from '../algorithm/cell';
import { DriverPingsRepository } from './driver-pings.repository';
import { DriversListener, PingEvent } from './drivers.listener';
import { DriversSimulator } from './drivers.simulator';
import { SimulatorControlDto } from './dto/simulator-control.dto';

@ApiTags('H3')
@Controller('api/h3/drivers')
export class DriversController {
  constructor(
    private readonly sim: DriversSimulator,
    private readonly listener: DriversListener,
    private readonly pings: DriverPingsRepository,
  ) {}

  @Post('simulate')
  control(@Body() dto: SimulatorControlDto) {
    if (dto.action === 'stop') {
      this.sim.stop();
      return { running: false };
    }
    this.sim.start(dto.count ?? 50, dto.intervalMs ?? 1000);
    return { running: true, drivers: this.sim.driverCount() };
  }

  @Get('stream')
  @Sse()
  stream(@Res() _res: Response): Observable<MessageEvent> {
    return fromEvent(this.listener, 'ping').pipe(
      map((evt) => ({ data: evt as PingEvent } as MessageEvent)),
    );
  }

  @Get('nearby')
  async nearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radiusMeters', ParseIntPipe) radiusMeters: number,
    @Query('k') kRaw?: string,
  ) {
    const k = kRaw ? Number(kRaw) : 1;
    const center = encodeCell(lat, lng);
    const cells = diskCells(center, k);
    const cellsAsBigint = cells.map((c) => BigInt(`0x${c}`).toString());
    const pings = await this.pings.latestPingsNearCells(cellsAsBigint, 500);
    return { center, k, cellCount: cells.length, pings };
  }
}
```

- [ ] **Step 10: Create `h3.controller.ts`**

```typescript
import {
  Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { LocationInputDto } from '@/shared/contracts/dto/location-input.dto';
import { NearbyQueryDto } from '@/shared/contracts/dto/nearby-query.dto';
import { H3Strategy } from './h3.strategy';
import { H3Engine } from './h3.repository';

@ApiTags('H3')
@Controller('api/h3/locations')
export class H3Controller {
  constructor(private readonly strategy: H3Strategy) {}

  @Post()
  insert(@Body() dto: LocationInputDto) { return this.strategy.insert(dto); }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    const r = await this.strategy.findById(id);
    if (!r) throw new NotFoundException();
    return r;
  }

  @Get('nearby')
  @ApiQuery({ name: 'engine', enum: ['h3-js', 'h3-pg'], required: false })
  findNearby(@Query() q: NearbyQueryDto, @Query('engine') engine?: H3Engine) {
    return this.strategy.findNearby({ ...q, engine });
  }
}
```

- [ ] **Step 11: Create `h3.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { H3Controller } from './h3.controller';
import { H3Repository } from './h3.repository';
import { H3Strategy } from './h3.strategy';
import { DriversController } from './drivers/drivers.controller';
import { DriverPingsRepository } from './drivers/driver-pings.repository';
import { DriversListener } from './drivers/drivers.listener';
import { DriversSimulator } from './drivers/drivers.simulator';

@Module({
  controllers: [H3Controller, DriversController],
  providers: [
    H3Repository,
    H3Strategy,
    DriverPingsRepository,
    DriversSimulator,
    DriversListener,
  ],
  exports: [H3Strategy],
})
export class H3Module {}
```

- [ ] **Step 12: Wire + smoke-test**

Add `H3Module` to `AppModule.imports`. Run `npm run start:dev`. Then:
```bash
# proximity (h3-js)
curl "http://localhost:3000/api/h3/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"

# proximity (h3-pg)
curl "http://localhost:3000/api/h3/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10&engine=h3-pg"

# start simulator
curl -X POST "http://localhost:3000/api/h3/drivers/simulate" \
  -H "Content-Type: application/json" \
  -d '{"action":"start","count":20,"intervalMs":1000}'

# SSE (in a separate terminal) — press Ctrl+C to stop
curl -N "http://localhost:3000/api/h3/drivers/stream"

# nearby drivers (wait a few seconds after starting simulator)
curl "http://localhost:3000/api/h3/drivers/nearby?lat=37.7749&lng=-122.4194&radiusMeters=2000&k=2"

# stop simulator
curl -X POST "http://localhost:3000/api/h3/drivers/simulate" \
  -H "Content-Type: application/json" \
  -d '{"action":"stop"}'
```
Expected: h3-js and h3-pg both return SF cluster results. SSE emits one event per driver per tick. `drivers/nearby` returns latest pings filtered by the H3 disk.

- [ ] **Step 13: Commit**

```bash
git add src/modules/h3 src/app.module.ts
git commit -m "feat(h3): h3-js + h3-pg engines, moving-object simulator, SSE stream"
```

## Phase 5 — Polish

### Task 18: Wire `AppModule` + Swagger at `/api/docs`

**Files:**
- Modify: `src/app.module.ts` (final form)
- Modify: `src/main.ts` (only if Swagger tags need adjustment)

- [ ] **Step 1: Final `src/app.module.ts`**

Replace the contents of `src/app.module.ts` with:

```typescript
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
```

- [ ] **Step 2: Verify Swagger enumerates every tag**

Run: `npm run start:dev`
Open: `http://localhost:3000/api/docs`
Expected: six tags visible — `2D Search`, `Fixed Grid`, `Geohash`, `Quadtree`, `S2`, `H3`. Every endpoint from Tasks 12–17 shows up under its correct tag, with working "Try it out" forms and SF defaults in request examples.

- [ ] **Step 3: Full run-through — insert → fetch → nearby across one module**

In Swagger UI:
1. `POST /api/geohash/locations` with `{ "name": "Dolores Park", "category": "park", "lat": 37.7596, "lng": -122.4269 }`
2. Copy the returned `id`, then `GET /api/geohash/locations/{id}`
3. `GET /api/geohash/locations/nearby?lat=37.7596&lng=-122.4269&radiusMeters=500&limit=20`

Expected: new row shows up in the nearby result set at distance 0.

- [ ] **Step 4: Lint + typecheck clean on the whole tree**

Run:
```bash
npm run lint
npx tsc --noEmit
```
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add src/app.module.ts
git commit -m "chore: wire all six modules into AppModule with request-id middleware"
```

---

### Task 19: Top-level README with 5-minute tour

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Location Indexing NestJS

Production-grade reference implementation of every approach covered in
**The Complete Guide to Location Indexing** — 2D search, fixed grid, geohash,
quadtree, Google S2, and Uber H3 — wired into one NestJS app so you can compare
them side by side.

Open `http://localhost:3000/api/docs` after bootstrap to explore every endpoint
interactively. Every `/nearby` response includes a `diagnostics` payload that
shows *how* the approach reached its answer (cells queried, expansion steps,
rows examined) — that's where the article's tradeoffs live.

## Quick start

```bash
git clone https://github.com/JoudAwad97/location-indexing-nestjs
cd location-indexing-nestjs
cp .env.example .env
npm install
docker compose up -d
npm run migrate
npm run seed -- --count 10000 --distribution city-cluster --seed 42 --truncate
npm run start:dev
# open http://localhost:3000/api/docs
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ NestJS modules (one per approach, same folder shape)        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐          │
│ │two-d-    │ │fixed-grid│ │geohash   │ │quadtree │          │
│ │search    │ │          │ │          │ │         │          │
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘          │
│ ┌──────────┐ ┌──────────┐                                   │
│ │s2        │ │h3        │                                   │
│ └──────────┘ └──────────┘                                   │
├─────────────────────────────────────────────────────────────┤
│ shared/ — ProximityStrategy contract, DTOs, geo utils,      │
│           pino logger, config, DB + Redis modules           │
├─────────────────────────────────────────────────────────────┤
│ Postgres 16 + PostGIS 3.4 + h3-pg   │   Redis 7             │
└─────────────────────────────────────────────────────────────┘
```

## Folder map

```
src/
├── main.ts                         # bootstrap: pino, Swagger, listen
├── app.module.ts                   # composes every module
├── shared/
│   ├── config/                     # envalid-validated config
│   ├── database/                   # pg Pool, node-pg-migrate
│   ├── logging/                    # pino + request-id
│   ├── redis/                      # ioredis client
│   ├── contracts/                  # ProximityStrategy + DTOs
│   └── geo/                        # haversine, bbox
├── seeding/                        # CLI seeder
└── modules/
    ├── two-d-search/               # naive + PostGIS engines
    ├── fixed-grid/                 # 9-cell integer grid
    ├── geohash/                    # Redis GEO + Postgres VARCHAR
    ├── quadtree/                   # in-memory, startup rebuild
    ├── s2/                         # RegionCover + geofencing
    └── h3/                         # h3-js + h3-pg + driver simulator
```

## 5-minute tour (read the article alongside)

| Stop | Article § | First file to open | Try it |
|------|-----------|--------------------|--------|
| 1. 2D search | §2 | `modules/two-d-search/algorithm/bounding-box.ts` | `GET /api/two-d-search/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000` — read the `diagnostics.notes.explainPlan` |
| 2. Fixed grid | §3 | `modules/fixed-grid/algorithm/neighbors.ts` | `GET /api/fixed-grid/locations/nearby?...` — `diagnostics.cellsQueried=9` and `perCellHits` shows density skew |
| 3. Geohash | §4 | `modules/geohash/algorithm/neighbors.ts` | Run `engine=redis` vs `engine=postgres` and compare |
| 4. Quadtree | §5 | `modules/quadtree/algorithm/build.ts` | `GET /api/quadtree/health` to see the tree stats |
| 5. S2 | §6 | `modules/s2/algorithm/region-cover.ts` | `POST /api/s2/geofences` with the sample polygon in Swagger |
| 6. H3 | §7 | `modules/h3/algorithm/cell.ts` | `POST /api/h3/drivers/simulate` then `curl -N .../drivers/stream` |

Each stop ends in one of the module READMEs — they list the boundary gotcha
to look for, the curl that *breaks* the naive approach, and which line of the
algorithm fixes it.

## Engine toggles

| Module | Engine query param | Values |
|--------|-------------------|--------|
| `two-d-search` | `?engine=` | `naive` (default), `postgis` |
| `geohash` | `?engine=` | `postgres` (default), `redis` |
| `h3` | `?engine=` | `h3-js` (default), `h3-pg` |

## Environment variables

All vars have safe defaults — see `.env.example` for the full list.

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | 3000 | HTTP port |
| `LOG_LEVEL` | `info` | pino log level |
| `POSTGRES_HOST` / `POSTGRES_PORT` / ... | local compose | Postgres connection |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis connection |
| `QUADTREE_LEAF_CAPACITY` | 100 | Max items per quadtree leaf |
| `H3_SIMULATOR_BBOX_*` | SF bbox | Driver random-walk bounds |

## Troubleshooting

- **`docker compose build postgres` fails:** ensure Docker has network access and the host can reach `apt.postgresql.org`. On some CI boxes you may need to add `--network host` to the build.
- **`@radarlabs/s2` native build fails on macOS:** install Xcode CLT (`xcode-select --install`). As a pure-TS fallback, swap the library for `s2js` — see `docs/architecture.md`.
- **`h3-pg` extension missing:** the custom Postgres image in `docker/postgres/` is required. If you bypassed the build (e.g., used `postgis/postgis:16-3.4` directly), the H3 `h3-pg` engine will fail. Rebuild: `docker compose build postgres && docker compose up -d postgres`.
- **Ports 5432/6379 already in use:** set `POSTGRES_PORT` / `REDIS_PORT` in `.env`.
- **Quadtree returns 503 on startup:** that's the readiness gate — wait for the log line `Quadtree ready: items=...`.

## Further reading

- Companion article: The Complete Guide to Location Indexing (Geohash, Quadtree, S2, H3)
- [Uber H3 docs](https://h3geo.org)
- [Google S2 geometry](http://s2geometry.io)
- [PostGIS manual](https://postgis.net/docs/manual-3.4/)
- [Redis GEO commands](https://redis.io/docs/latest/commands/#geo)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: top-level README with 5-minute tour and engine-toggle reference"
```

---

### Task 20: Per-module READMEs + `docs/architecture.md`

**Files:**
- Create: `src/modules/two-d-search/README.md`
- Create: `src/modules/fixed-grid/README.md`
- Create: `src/modules/geohash/README.md`
- Create: `src/modules/quadtree/README.md`
- Create: `src/modules/s2/README.md`
- Create: `src/modules/h3/README.md`
- Create: `docs/architecture.md`

Each module README follows the same shape: one-paragraph intro → article link → how to run → gotcha callout with a breaking example → file map. Populate each from the per-module details in spec §7.1–§7.6.

- [ ] **Step 1: Create `src/modules/two-d-search/README.md`**

```markdown
# `two-d-search/` — Naive query + PostGIS baseline

The starter query every engineer writes: two `FLOAT` columns, two `BETWEEN`s,
zero spatial awareness. This module ships the naive version to let you watch
the optimizer fail on `EXPLAIN ANALYZE`, and a PostGIS engine next to it as
the sphere-aware escape hatch.

**Article §2 — Two-Dimensional Search: The Naive Approach**

## Run it

```bash
# Naive (the query that breaks at scale)
curl "http://localhost:3000/api/two-d-search/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"

# PostGIS (sphere-aware, GIST-indexed)
curl "http://localhost:3000/api/two-d-search/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10&engine=postgis"
```

Compare `diagnostics.notes.explainPlan` between the two — naive shows a Bitmap Heap Scan with "Rows Removed by Filter"; PostGIS shows a GIST index scan.

## Gotcha

At 200M rows, the naive engine's `WHERE lat BETWEEN ? AND lng BETWEEN ?` scans
over a million rows just to filter down to a few hundred matches. Composite
B-tree indexes are one-dimensional — the second range becomes a filter, not a seek.

## Files

- `algorithm/bounding-box.ts` — lat/lng + radius → degree bbox
- `two-d-search.repository.ts` — both SQL queries with `EXPLAIN` capture for diagnostics
- `two-d-search.strategy.ts` — engine dispatch + distance filter
- `two-d-search.controller.ts` — REST endpoints
```

- [ ] **Step 2: Create `src/modules/fixed-grid/README.md`**

```markdown
# `fixed-grid/` — 1D cell IDs + always-9-cells rule

Quantize lat/lng into an integer `cell_id`, push `cell_id = ANY(...)` into SQL,
and watch B-tree index seeks do the work that range scans couldn't.

**Article §3 — Fixed Grid**

## Run it

```bash
curl "http://localhost:3000/api/fixed-grid/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"
```

`diagnostics.cellsQueried` will always be 9 (center + 8 neighbors). `diagnostics.notes.perCellHits` shows the density skew — SF is much denser than the surrounding cells.

## Gotcha

With a single global cell size, dense cities return thousands of rows per cell
while rural areas return zero. No single size works globally — fix the density
adaptively (→ quadtree) or hierarchically (→ S2/H3).

## Files

- `algorithm/cell-id.ts` — cell ID formula
- `algorithm/neighbors.ts` — center + 8-neighbor computation
- `fixed-grid.repository.ts` — `WHERE grid_1km = ANY($1)`
- `fixed-grid.strategy.ts` — query + distance filter
```

- [ ] **Step 3: Create `src/modules/geohash/README.md`**

```markdown
# `geohash/` — Prefix search with Redis + Postgres engines

Geohash collapses 2D lat/lng into a 1D base-32 string via recursive bisection.
Shared prefix ≈ nearby location. This module ships two engines — Redis GEOSEARCH
(what Yelp uses) and Postgres VARCHAR prefix matching — backed by the same
dataset via a dual-writer on insert.

**Article §4 — Geohash**

## Run it

```bash
# Postgres prefix engine (default)
curl "http://localhost:3000/api/geohash/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"

# Redis GEOSEARCH engine
curl "http://localhost:3000/api/geohash/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10&engine=redis"
```

## Gotcha — the prime-meridian problem

Geohash `u000` (just east of 0° longitude) and `ezzz` (just west of 0°) are
physically ~30 km apart but share zero prefix. A naive `WHERE geohash LIKE '9q8zn%'`
query misses the other side of the boundary. The fix is always querying center
+ 8 neighbors — see `algorithm/neighbors.ts`.

## Files

- `algorithm/precision.ts` — radius → precision map
- `algorithm/neighbors.ts` — 9-hash query set
- `geohash.postgres.repository.ts` — `LIKE ANY` prefix query
- `geohash.redis.repository.ts` — GEOSEARCH wrapper
- `geohash.strategy.ts` — engine dispatch + expand loop
```

- [ ] **Step 4: Create `src/modules/quadtree/README.md`**

```markdown
# `quadtree/` — In-memory adaptive subdivision

Recursive tree: each node that holds more than `leafCapacity` items splits into
four quadrants and redistributes. Built from Postgres at startup; all queries
run in-process. Article §5 describes the ~1.7 GB memory footprint at 200M items.

**Article §5 — Quadtree**

## Run it

```bash
curl "http://localhost:3000/api/quadtree/health"  # wait for ready:true
curl "http://localhost:3000/api/quadtree/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"
```

`diagnostics.notes.treeMaxDepth` and `cellsQueried` show how many tree nodes the
query traversed. Dense SF subdivides deeper than sparse Montana, which is the
whole point of a quadtree over a fixed grid.

## Gotcha

The tree is read-only between restarts. Inserts go to Postgres but don't appear
in quadtree queries until the next `onModuleInit`. Live updates are possible but
require locking — most production systems accept nightly rebuild instead.

## Files

- `algorithm/node.ts` — QuadtreeNode with `subdivide()` + `intersects()`
- `algorithm/build.ts` — iterative insert + redistribute
- `algorithm/query.ts` — range-collect with stats
- `quadtree.service.ts` — `OnModuleInit` rebuild, readiness gate
```

- [ ] **Step 5: Create `src/modules/s2/README.md`**

```markdown
# `s2/` — Sphere-aware cells + geofencing

Google S2 projects Earth onto a cube, tiles each face with a quadtree, and
snakes a Hilbert curve through them. Adjacent points on the curve are adjacent
on the sphere. `RegionCoverer` returns mixed-level cells that tile an arbitrary
polygon — the core primitive behind geofencing.

**Article §6 — Google S2**

## Run it

```bash
# proximity
curl "http://localhost:3000/api/s2/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&limit=10"

# create a geofence
curl -X POST "http://localhost:3000/api/s2/geofences" -H "Content-Type: application/json" -d '{
  "name": "Downtown SF",
  "polygon": { "type": "Polygon", "coordinates": [[
    [-122.43, 37.77], [-122.41, 37.77], [-122.41, 37.79],
    [-122.43, 37.79], [-122.43, 37.77]
  ]]}
}'

# match a point against all stored geofences
curl "http://localhost:3000/api/s2/geofences/match?lat=37.78&lng=-122.42"
```

## Gotcha

RegionCover returns cells at **varying levels**. A `geofence_cells` row at
level 12 covers a much larger area than a row at level 16. The match algorithm
has to compute the query point's cell at *each* level present in the table —
not just one — and test all candidates.

## Files

- `algorithm/cell.ts` — `@radarlabs/s2` wrappers
- `algorithm/region-cover.ts` — RegionCoverer for bboxes and polygons
- `s2.repository.ts` — geofence transactions + multi-level match
- `s2.strategy.ts` — proximity + geofence logic
```

- [ ] **Step 6: Create `src/modules/h3/README.md`**

```markdown
# `h3/` — Hexagonal equidistance + moving objects

Uber's H3 projects Earth onto an icosahedron and tiles it with hexagons plus
exactly 12 pentagons (one per icosahedron vertex). Every hexagon's 6 neighbors
are equidistant — the reason H3 is used for surge pricing, demand aggregation,
and driver dispatch.

**Article §7 — Uber's Hexagonal Grid**

## Run it

```bash
# proximity with h3-js (app-side)
curl "http://localhost:3000/api/h3/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000"

# proximity with h3-pg (SQL-side)
curl "http://localhost:3000/api/h3/locations/nearby?lat=37.7749&lng=-122.4194&radiusMeters=1000&engine=h3-pg"

# start the driver simulator — writes pings to driver_pings every interval
curl -X POST "http://localhost:3000/api/h3/drivers/simulate" \
     -H "Content-Type: application/json" \
     -d '{"action":"start","count":20,"intervalMs":1000}'

# SSE stream of every ping (run in a separate terminal)
curl -N "http://localhost:3000/api/h3/drivers/stream"

# latest ping per driver within H3 disk(k=2) of SF
curl "http://localhost:3000/api/h3/drivers/nearby?lat=37.7749&lng=-122.4194&radiusMeters=2000&k=2"

# stop simulator
curl -X POST "http://localhost:3000/api/h3/drivers/simulate" \
     -H "Content-Type: application/json" -d '{"action":"stop"}'
```

## Gotcha — the 12 pentagons

You can't tile a sphere perfectly with hexagons. H3 has 12 pentagonal cells per
resolution. Any algorithm that assumes a cell has 6 neighbors breaks near these
pentagons. Cell area is also ~0.5× that of a normal hexagon at the same resolution.

## Files

- `algorithm/cell.ts` — `h3-js` wrappers (`latLngToCell`, `gridDisk`, `gridRing`)
- `algorithm/expand.ts` — `k`-expansion for minResults
- `h3.repository.ts` — both engines (`ANY(bigint[])` and `h3_grid_disk(...)`)
- `drivers/drivers.simulator.ts` — N-driver random walk
- `drivers/drivers.listener.ts` — Postgres `LISTEN/NOTIFY` bridge
- `drivers/drivers.controller.ts` — simulator control + SSE stream + nearby pings
```

- [ ] **Step 7: Create `docs/architecture.md`**

```markdown
# Architecture

## Why a single `locations` table

Every approach indexes the *same* rows. Keeping one table with denormalized
columns (`geohash_12`, `h3_r9`, `s2_cell_l16`, `grid_1km`, `geog`) lets the
seeder write each row once, lets the reader run `\di+ locations` to compare
index sizes directly, and matches real-world migration scenarios where a team
adds a new spatial index next to an existing one before cutting over.

The downside is that inserts cost more (every insert populates all indexes).
For a teaching repo the cost is worth the clarity.

## Why `ProximityStrategy` is the shared contract

Every module — down to the weird ones (quadtree in-memory, h3 moving objects) —
exposes `insert`, `findById`, and `findNearby`. That means you can compare the
same query across six implementations by changing only the URL path. The
`diagnostics` payload on every response lets you see *why* the answers differ
(or agree).

## S2 native-build fallback: `s2js`

`@radarlabs/s2` uses native Node bindings to Google's reference C++ library.
That's the most faithful production implementation, but it needs a working
node-gyp toolchain. On macOS without Xcode CLT, install fails. For a pure-TS
fallback, `s2js` (Terran Agency) is actively maintained and ships full
`LatLng`, `Cell`, `Polygon`, and `RegionCoverer` equivalents. Swap the import
in `modules/s2/algorithm/cell.ts` and `region-cover.ts`; API surface is
comparable.

## `h3-js` vs `h3-pg` — when to pick which

- `h3-js` (default): WASM library that runs inside the NestJS process. Cell
  computation, disk/ring expansion, and neighbor logic all happen in TypeScript.
  Works everywhere Node does. Algorithm is visible in your app code — matches
  the teaching story of this repo.

- `h3-pg`: Postgres extension that exposes the full H3 v4 API as SQL
  functions. The extension runs the same C reference implementation Uber ships,
  inside the database. Good when the query set is H3-heavy and you want
  colocated computation with the data; pays a native-extension install cost.

Both are production-grade. They are intentionally toggleable so the reader can
run the same query through both and see identical results.

## Quadtree: the rolling-deploy story (not coded)

The spec intentionally doesn't implement rolling deploy or blue/green quadtree
rebuild. In production, the options are:

1. **Rolling rebuild.** Only a small percentage of the cluster rebuilds at a
   time. The remaining instances serve traffic with a stale tree.
2. **Blue/green.** Bring up a whole new cluster with the fresh tree, flip
   traffic once ready. Cleanest switchover but creates a thundering herd on
   Postgres as every new instance loads data simultaneously. Read replicas
   help.

Most teams run option 1 with a nightly rebuild job and accept a ~24h stale
window on adds/removes. The article covers the tradeoffs in §5 — this repo
leaves them as prose so the code stays teachable.

## Driver pings — `LISTEN/NOTIFY` vs Redis Streams

The SSE stream is powered by Postgres `LISTEN/NOTIFY` — a row-inserted trigger
publishes a JSON payload on `driver_pings_channel`, and the `DriversListener`
re-emits it to SSE subscribers. This is simple and fits the one-table story.

In real production H3 pipelines (Uber Kepler, etc.) the pings stream through
Kafka or Redis Streams so multiple downstream systems (pricing, dispatch,
analytics) can fan out. Swapping in Redis Streams is a ~50-line refactor —
left as an exercise.
```

- [ ] **Step 8: Commit**

```bash
git add src/modules/*/README.md docs/architecture.md
git commit -m "docs: per-module READMEs + architecture deep-dive"
```

---

## Final verification

- [ ] **Step 1: End-to-end smoke from clean state**

```bash
docker compose down -v
docker compose up -d
npm run migrate
npm run seed -- --count 10000 --distribution city-cluster --seed 42 --truncate
npm run lint
npx tsc --noEmit
npm run start:dev
```

Open `http://localhost:3000/api/docs` and hit one `/nearby` endpoint per module
from Swagger. Every response should return SF results with a populated
`diagnostics` payload.

- [ ] **Step 2: Tag the initial release**

```bash
git tag v0.1.0 -m "v0.1.0 — initial implementation of all six location-indexing approaches"
git log --oneline
```

Expected: roughly one commit per task, plus the initial spec commit.
