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
