# Location Indexing NestJS — Design Spec

**Date:** 2026-04-22
**Status:** Draft — awaiting user review
**Companion article:** `article-system/articles/location-indexing-complete-guide/95-final.md`
**Target GitHub repo:** https://github.com/JoudAwad97/location-indexing-nestjs

---

## 1. Purpose

Build a production-grade NestJS reference project that implements every location-indexing approach covered in the companion article:

1. 2D search (naive + PostGIS)
2. Fixed grid
3. Geohash (Redis GEO + Postgres VARCHAR)
4. Quadtree (in-memory, startup rebuild)
5. Google S2 (with geofencing)
6. Uber H3 (with moving-object simulator; `h3-js` + `h3-pg` engines)

The repo is optimized for **reader comprehension**: someone should be able to clone it, run one command, and understand the tradeoffs between all six approaches in one sitting. Code quality is production-grade so the same patterns hold up if lifted into a real system.

---

## 2. Goals & non-goals

### Goals
- Faithfully implement every chapter of the article
- Single `docker compose up` bring-up on macOS, Linux, and Windows (WSL2)
- Identical REST contract across all six approaches so they can be compared side-by-side
- Diagnostics payload in every response so the reader sees *how* the approach reached its answer (cells queried, expansion steps, rows examined)
- Top-level README serves as a guided "5-minute tour" through the repo in article order
- Code is strict-TypeScript, linted, production-shaped (NestJS conventions, proper DI, config validation, structured logs)

### Non-goals
- Performance benchmarking. No `npm run bench` harness, no p50/p95 reporting. Tradeoffs are *described* in each module's README, not measured.
- Automated testing. No unit tests, no contract tests, no e2e tests. Reader validates behaviour via Swagger, curl examples in READMEs, and inspection of the `diagnostics` response payload.
- Health-check endpoints, graceful shutdown plumbing, metrics/tracing exporters — beyond what specific modules need (quadtree has its own `/health` because readiness is algorithmically meaningful).
- Frontend or web UI. Swagger is the interactive surface.
- Production secret handling (KMS, Vault) — `.env`-based config only.

---

## 3. Architecture

### 3.1 Project layout

```
location-indexing-nestjs/
├── README.md                     # repo tour, 5-min walkthrough, folder map
├── docker-compose.yml            # Postgres 16 + PostGIS 3.4 + h3-pg, Redis 7
├── docker/
│   └── postgres/Dockerfile       # extends postgis/postgis:16-3.4, apt-installs postgresql-16-h3
├── .env.example
├── package.json
├── tsconfig.json                 # strict mode on
├── nest-cli.json
├── .eslintrc.cjs
├── .prettierrc
├── src/
│   ├── main.ts                   # bootstrap: pino → config validation → Swagger → listen
│   ├── app.module.ts
│   ├── shared/
│   │   ├── database/             # node-pg-migrate config + migrations/
│   │   ├── redis/                # RedisModule + client provider
│   │   ├── config/               # envalid schema, ConfigModule
│   │   ├── logging/              # pino setup + request-id middleware
│   │   ├── contracts/            # ProximityStrategy interface + shared DTOs
│   │   └── geo/                  # haversine, bbox utils, distance helpers
│   ├── seeding/
│   │   ├── seed.command.ts       # CLI entry: `npm run seed -- --count N`
│   │   └── generators/           # uniform.ts, city-cluster.ts, hotspot.ts
│   └── modules/
│       ├── two-d-search/
│       ├── fixed-grid/
│       ├── geohash/
│       ├── quadtree/
│       ├── s2/
│       └── h3/
└── docs/
    ├── superpowers/specs/2026-04-22-location-indexing-nestjs-design.md
    └── architecture.md           # deeper dive: shared infra, DB schema, data-model rationale
```

### 3.2 Per-module folder shape (identical for all six modules)

```
<approach>/
├── <approach>.module.ts
├── <approach>.controller.ts      # REST endpoints
├── <approach>.service.ts         # orchestration
├── <approach>.repository.ts      # DB/Redis/in-memory access
├── <approach>.strategy.ts        # implements ProximityStrategy
├── algorithm/                    # pure functions, heavy inline teaching comments
│   └── *.ts
└── README.md                     # article section link, curl examples, gotchas
```

Identical shape across modules means a reader can diff them mentally — same skeleton, different algorithmic guts.

---

## 4. Shared contract & REST shape

### 4.1 Strategy interface

```typescript
// src/shared/contracts/proximity-strategy.interface.ts

export interface ProximityStrategy {
  readonly name: string;                  // 'geohash' | 'h3' | ...
  insert(loc: LocationInput): Promise<LocationRecord>;
  findNearby(q: NearbyQuery): Promise<NearbyResult>;
  findById(id: string): Promise<LocationRecord | null>;
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit?: number;        // default 50
  minResults?: number;   // triggers expand-strategy when below
}

export interface NearbyResult {
  strategy: string;
  results: Array<LocationRecord & { distanceMeters: number }>;
  diagnostics: {
    cellsQueried: number;
    expansionSteps: number;
    dbRowsExamined?: number;
    latencyMs: number;
  };
}
```

`diagnostics` is the teaching payload. Every `/nearby` response carries it.

### 4.2 REST surface (identical across all six modules)

```
POST   /api/<strategy>/locations            # insert
GET    /api/<strategy>/locations/:id        # fetch
GET    /api/<strategy>/locations/nearby     # ?lat&lng&radius&limit&minResults
```

### 4.3 Strategy-specific endpoints

```
# two-d-search
GET    /api/two-d-search/locations/nearby?engine=naive|postgis

# geohash
GET    /api/geohash/locations/nearby?engine=redis|postgres

# s2
POST   /api/s2/geofences                         # GeoJSON Polygon -> covering S2 cells (mixed levels via RegionCoverer)
GET    /api/s2/geofences/match?lat=&lng=         # containment test across every level present in geofence_cells

# h3
GET    /api/h3/locations/nearby?engine=h3-js|h3-pg
POST   /api/h3/drivers/simulate                  # { count, intervalMs, action: 'start'|'stop' }
GET    /api/h3/drivers/stream                    # SSE: new driver pings as they arrive
GET    /api/h3/drivers/nearby?lat=&lng=&radius=  # H3 gridDisk over latest pings
```

All DTOs and `class-validator` decorators live in `shared/contracts/` — no duplication across modules.

---

## 5. Data model & persistence

### 5.1 Infra stack

| Service | Version | Role |
|---|---|---|
| Postgres | 16 | Primary store. PostGIS + h3-pg extensions both enabled |
| PostGIS | 3.4 | Sphere-aware baseline (2D-search `postgis` engine) |
| h3-pg | latest on Postgres 16 | H3 SQL functions (H3 `h3-pg` engine) |
| Redis | 7 | Geohash `redis` engine + future caching |

Postgres image is a custom `Dockerfile` extending `postgis/postgis:16-3.4` and `apt install postgresql-16-h3`. Single image, both extensions.

### 5.2 Single `locations` table — serves all six strategies

```sql
CREATE TABLE locations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,

  -- denormalized strategy columns, populated by seeder and INSERT path
  geohash_12    VARCHAR(12) NOT NULL,
  h3_r9         BIGINT NOT NULL,
  s2_cell_l16   BIGINT NOT NULL,
  grid_1km      BIGINT NOT NULL,
  geog          GEOGRAPHY(POINT, 4326) NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lat_lng     ON locations (lat, lng);
CREATE INDEX idx_grid_1km    ON locations (grid_1km);
CREATE INDEX idx_geohash_12  ON locations (geohash_12 varchar_pattern_ops);
CREATE INDEX idx_h3_r9       ON locations (h3_r9);
CREATE INDEX idx_s2_l16      ON locations (s2_cell_l16);
CREATE INDEX idx_geog_gist   ON locations USING GIST (geog);
```

Rationale for one table: matches real-world migration scenarios, single seeder pass, each index's size is itself a teaching point (reader runs `\di+ locations` and sees the storage cost).

### 5.3 Auxiliary tables

```sql
-- S2 geofencing
CREATE TABLE geofences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  polygon_geojson JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE geofence_cells (
  geofence_id     UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  s2_cell_id      BIGINT NOT NULL,
  level           SMALLINT NOT NULL,
  PRIMARY KEY (geofence_id, s2_cell_id)
);
CREATE INDEX idx_geofence_s2_cell ON geofence_cells (s2_cell_id);

-- H3 moving-object simulator
CREATE TABLE driver_pings (
  driver_id   UUID NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  h3_r9       BIGINT NOT NULL,
  seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, seen_at)
);
CREATE INDEX idx_driver_pings_h3_recent ON driver_pings (h3_r9, seen_at DESC);
```

### 5.4 Strategy-specific access patterns

| Strategy | Read path |
|---|---|
| `two-d-search` naive | `WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?` |
| `two-d-search` postgis | `ST_DWithin(geog, ST_MakePoint(?, ?)::geography, $radius)` |
| `fixed-grid` | Compute 9 cell IDs in app, `WHERE grid_1km = ANY($1::bigint[])` |
| `geohash` redis | `GEOADD` at seed/insert; `GEOSEARCH ... FROMLONLAT ... BYRADIUS ...` |
| `geohash` postgres | Compute prefix + 8 neighbors; `WHERE geohash_12 LIKE ANY($1)` |
| `quadtree` | In-memory tree built from table at boot; no DB on read |
| `s2` | Compute covering cells for the query circle; `WHERE s2_cell_l16 = ANY($1::bigint[])` |
| `s2` geofence match | `WHERE s2_cell_id = ANY($1)` against `geofence_cells` |
| `h3` h3-js | Compute `gridDisk(center, k)`; `WHERE h3_r9 = ANY($1::bigint[])` |
| `h3` h3-pg | `WHERE h3_r9 = ANY(h3_grid_disk($center::h3index, $k))` |

### 5.5 Migrations

`node-pg-migrate` (pure SQL files in `src/shared/database/migrations/`) — chosen over TypeORM migrations because SQL is more readable for teaching and keeps the DB schema honest.

---

## 6. Library choices

Rule: use the most production-grade, actively maintained option per slot.

| Slot | Library | Rationale |
|---|---|---|
| PostGIS baseline | `postgis/postgis:16-3.4` | The SQL-spatial standard |
| Geohash encoding | `ngeohash` | Most-downloaded geohash lib on npm, stable, tiny |
| Geohash DB engine | Redis native `GEOADD`/`GEOSEARCH` | Redis built-in; what Yelp uses |
| S2 | `@radarlabs/s2` | Native bindings to Google's reference `s2geometry` C++ lib; maintained by Radar (commercial geo company) |
| H3 (app) | `h3-js` v4 | Official Uber JS library, WASM-backed |
| H3 (DB) | `h3-pg` v4 | Official-adjacent Uber Postgres extension, ships H3 v4 API as SQL functions |
| Quadtree | Hand-built | The whole point; no lib teaches the algorithm |
| Fixed grid, 2D naive | None — pure math / SQL | Trivial |

**Native-build note:** `@radarlabs/s2` requires `node-gyp`. Docker-first means compilation happens once in the Postgres-side build (N/A — S2 is app-side, so it builds in the NestJS container or on `npm install`). Fallback for pure-TS dev without a native toolchain: `s2js` — documented in `docs/architecture.md`.

---

## 7. Per-module implementation plan

### 7.1 `two-d-search/`
Teaching goal: show the naive bounding-box query, watch the B-tree optimizer fail, introduce PostGIS as the escape hatch.

- `algorithm/bounding-box.ts` — lat/lng + radius (meters) → bbox in degrees, using `cos(lat)` for lng shrinkage
- Two engines: `naive` (composite B-tree on `(lat, lng)`), `postgis` (`ST_DWithin` with `GIST` index)
- `diagnostics`: include the query plan summary (`EXPLAIN (FORMAT JSON)`) so the reader sees the bitmap-heap-scan pattern inline
- `README.md` links to article §2

### 7.2 `fixed-grid/`
Teaching goal: 1D integer cell IDs, the always-query-9-cells rule, the global-density problem.

- `algorithm/cell-id.ts` — `floor(lat / cellSize) * gridWidth + floor(lng / cellSize)`
- `algorithm/neighbors.ts` — compute the 9 cell IDs surrounding a query point
- Engine: Postgres `WHERE grid_1km = ANY($1)`
- `diagnostics.cellsQueried = 9`, plus per-cell hit count (reader sees dense-area skew)
- `README.md` links to article §3

### 7.3 `geohash/`
Teaching goal: prefix search, 9-cell boundary fix, Redis vs Postgres side-by-side.

- `algorithm/encode.ts` — bit-by-bit encoder with teaching comments (base-32 alphabet `0-9bcdefghjkmnpqrstuvwxyz`, `lng → lat → lng → lat` alternation, 5 bits per char)
- `algorithm/neighbors.ts` — compute the 8 neighbors of a hash at a given precision
- `algorithm/expand.ts` — "remove a digit" expansion loop for `minResults`
- Two engines: `redis` (`GEOADD` / `GEOSEARCH`), `postgres` (VARCHAR prefix via `LIKE ANY`)
- Dual-writer: `service.insert()` writes to both stores so the engines stay in sync
- `README.md` links to article §4; curl examples include the prime-meridian case (`u000` vs `ezzz`) showing the boundary bug without the 9-cell fix

### 7.4 `quadtree/`
Teaching goal: in-memory adaptive subdivision, startup rebuild cost, neighbor expansion.

- `algorithm/node.ts` — `QuadtreeNode` class with bbox, `children: [NW, NE, SW, SE]`, and leaf `businesses: LocationRecord[]`
- `algorithm/build.ts` — recursive subdivide; leaf capacity = 100 (article value)
- `algorithm/query.ts` — traverse-to-leaf + neighbor expansion
- `quadtree.service.ts` — `OnModuleInit`: stream rows from Postgres in batches, build tree, flip `ready` flag
- `quadtree.controller.ts` — `/nearby` returns `503 Service Unavailable` with `Retry-After` header if not ready; `/health` is the readiness probe
- `diagnostics`: tree depth visited, leaves inspected, neighbor expansions used
- `README.md` links to article §5; rolling-deploy and blue/green tradeoffs are explained in prose, not coded

### 7.5 `s2/`
Teaching goal: sphere-aware cells, RegionCover for arbitrary polygons → geofencing.

- `algorithm/cell.ts` — thin wrapper around `@radarlabs/s2` for `latLngToCellId`, `cellIdToParent`, `neighbors`
- `algorithm/region-cover.ts` — `RegionCoverer` wrapper with `minLevel` / `maxLevel` / `maxCells` config, accepting a bbox or polygon
- Standard `/nearby` computes covering cells of the query circle and queries `WHERE s2_cell_l16 = ANY($1)`
- `POST /geofences` accepts a GeoJSON Polygon body, computes covering cells via `RegionCoverer` (mixed levels, `minLevel` / `maxLevel` configured), writes one row per covering cell to `geofence_cells` with its actual `level`
- `GET /geofences/match` — RegionCover produces cells at varying levels, so matching enumerates the distinct levels present in `geofence_cells`, computes the query point's cell at each of those levels, and runs a single `WHERE s2_cell_id = ANY($candidates)` lookup. Returns the set of geofence IDs covering the point
- `README.md` links to article §6

### 7.6 `h3/`
Teaching goal: hexagonal equidistance, `gridDisk` expand, moving-object updates.

- `algorithm/cell.ts` — wraps `h3-js` for `latLngToCell`, `cellToLatLng`, `gridDisk`, `gridRing`
- `algorithm/expand.ts` — iterate `k` from 1 upward, `gridDisk(center, k)`, stop at `minResults`
- Two engines: `h3-js` (compute cells in app, `WHERE h3_r9 = ANY($1)`), `h3-pg` (`WHERE h3_r9 = ANY(h3_grid_disk($center, $k))`)
- Moving-object simulator:
  - `drivers.simulator.ts` — `setInterval` walks N synthetic drivers along random paths in the SF bbox; UPSERTs latest ping every `intervalMs`
  - `POST /drivers/simulate` controls the simulator lifecycle
  - `GET /drivers/stream` — Server-Sent Events. Backed by Postgres `LISTEN/NOTIFY` on `driver_pings_channel`, emitted by a trigger on `driver_pings` inserts
  - `GET /drivers/nearby` — H3 `gridDisk` over latest pings per `driver_id`
- `README.md` links to article §7; covers `h3-js` vs `h3-pg` tradeoffs

---

## 8. Seeder

CLI entrypoint: `npm run seed -- --count 1000000 --distribution city-cluster --seed 42`

| Flag | Purpose |
|---|---|
| `--count` | Total rows. Tiers: 10K (quick demo), 100K, 1M, 10M |
| `--distribution` | `uniform`, `city-cluster` (SF + NYC + Tokyo + Berlin hotspots + sparse fill), `hotspot` (single city) |
| `--seed` | Deterministic RNG seed |
| `--truncate` | Wipe table before seed |

Behaviour:

- One Postgres batch insert per N rows (configurable batch size)
- Every row populates all denormalized columns (`geohash_12`, `h3_r9`, `s2_cell_l16`, `grid_1km`, `geog`) in the same pass
- Redis `GEOADD` runs in a parallel pipeline so the two stores stay in sync
- Targets ~1M rows in ~30 seconds on a modern laptop

---

## 9. Dev workflow

### 9.1 First-run bootstrap

```bash
git clone https://github.com/JoudAwad97/location-indexing-nestjs
cd location-indexing-nestjs
cp .env.example .env
npm install
docker compose up -d
npm run migrate
npm run seed -- --count 10000
npm run start:dev   # http://localhost:3000/api/docs
```

### 9.2 npm scripts

```
start:dev, start, build          # NestJS standard
lint, lint:fix, format           # ESLint + Prettier
migrate, migrate:down            # node-pg-migrate
seed                             # synthetic seeder CLI
db:shell, redis:cli              # quick exec into compose containers
```

### 9.3 Environment

`.env.example` defines every var with a safe default. Validated at boot by `envalid`. A missing or malformed value fails fast with a readable message.

### 9.4 Docker compose

```yaml
services:
  postgres:
    build: ./docker/postgres      # extends postgis/postgis:16-3.4, installs postgresql-16-h3
    environment: { POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD }
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ['5432:5432']
    healthcheck: pg_isready ...
  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    healthcheck: redis-cli ping
volumes: { postgres_data: }
```

---

## 10. Documentation

### 10.1 Top-level README.md

The navigation backbone. Structure:

1. What this is — one paragraph, screenshot of Swagger, link to the companion article
2. Quick start — the seven-line block from §9.1
3. Architecture diagram — mermaid, modules → shared → infra
4. Folder map — 1:1 with the tree from §3.1
5. **5-minute tour** — walks through each approach in article order. For each: which file to open first (`algorithm/*.ts`), which endpoint to hit (curl example + expected diagnostics), which article section to read alongside, the gotcha to notice
6. Engine-toggle reference — table, module × engines
7. Environment variables — full table with defaults and purpose
8. Troubleshooting — common pitfalls (native build, ports in use, extension missing)
9. Article + further reading

### 10.2 Per-module READMEs

Each `modules/<approach>/README.md`:

- One-paragraph explanation
- Link to article section
- How to run (curl command + expected output)
- Boundary gotcha callout with an example that reproduces it
- File map (what lives in `algorithm/`, `service.ts`, `controller.ts`)

### 10.3 Swagger (`/api/docs`)

- Tags grouped by approach: `2D Search`, `Fixed Grid`, `Geohash`, `Quadtree`, `S2`, `H3`
- SF coordinates as default examples in every endpoint (`37.7749, -122.4194`)
- Response examples include the `diagnostics` payload
- Each tag description links back to the matching article section

### 10.4 `docs/architecture.md`

Deeper dive than the README:

- Shared-module rationale
- DB schema rationale (why one table, not six)
- Native-build fallback for `@radarlabs/s2` (i.e., switching to `s2js` when node-gyp is unavailable)
- `h3-js` vs `h3-pg` tradeoff analysis

---

## 11. Code quality

| Concern | Tool |
|---|---|
| Formatter | Prettier — default config, no custom rules |
| Linter | ESLint with `@typescript-eslint` strict preset |
| Type strictness | `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true` |

Intentionally omitted:

- Husky / lint-staged / pre-commit hooks
- GitHub Actions CI workflows
- Test runners, test files, testing dependencies

`npm run lint` exists. That is the full quality story. Reader validates correctness via Swagger, curl examples in module READMEs, and inspection of the `diagnostics` response payload.

---

## 12. Comment discipline

- `algorithm/*.ts` files get teaching comments: the non-obvious math, article references, gotcha callouts
- Everywhere else: no comments unless the WHY is genuinely non-obvious
- Teaching prose lives in READMEs + module docs + Swagger descriptions — not scattered through service/controller code

---

## 13. Out of scope (explicit)

These are called out so the implementation plan does not drift:

- Automated tests of any kind
- Benchmark harness or performance reports
- CI/CD pipelines or GitHub Actions
- Pre-commit hooks
- Health/metrics endpoints beyond quadtree readiness
- Blue/green or rolling-deploy code for quadtree (prose only)
- Real OpenStreetMap import
- Authentication / authorization
- Multi-tenancy
- Rate limiting
- Frontend UI

---

## 14. Build order (for the implementation plan)

The `writing-plans` skill will break this into steps. Suggested sequence:

1. Scaffolding — NestJS app, `tsconfig`, ESLint, Prettier, `docker-compose.yml`, custom Postgres image, `.env.example`, `envalid` config module
2. Shared infra — `SharedModule`, database module with `node-pg-migrate`, Redis module, pino logger, `ProximityStrategy` interface and DTOs
3. `locations` table migration + seeder CLI
4. Modules in article order:
   1. `two-d-search/` (both engines)
   2. `fixed-grid/`
   3. `geohash/` (both engines)
   4. `quadtree/`
   5. `s2/` (including geofencing)
   6. `h3/` (both engines, simulator last)
5. Swagger wiring
6. Top-level README and `docs/architecture.md`
7. Per-module READMEs
