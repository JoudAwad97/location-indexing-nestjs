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
