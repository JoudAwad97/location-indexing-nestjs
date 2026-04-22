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
