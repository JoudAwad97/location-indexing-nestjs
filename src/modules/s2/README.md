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
