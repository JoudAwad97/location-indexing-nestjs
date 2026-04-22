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
