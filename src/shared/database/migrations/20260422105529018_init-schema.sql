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
