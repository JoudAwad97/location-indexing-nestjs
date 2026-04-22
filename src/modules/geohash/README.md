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
