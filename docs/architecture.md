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
