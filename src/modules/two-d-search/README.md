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
