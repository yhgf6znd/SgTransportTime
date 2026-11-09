CREATE TABLE IF NOT EXISTS bus_route_sync (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  active_generation TEXT,
  active_updated_at TEXT,
  in_progress_generation TEXT,
  next_skip INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  cleanup_pending INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

INSERT OR IGNORE INTO bus_route_sync (singleton) VALUES (1);

CREATE TABLE IF NOT EXISTS bus_route_rows (
  generation TEXT NOT NULL,
  service_no TEXT NOT NULL,
  operator TEXT,
  direction TEXT NOT NULL,
  stop_sequence INTEGER NOT NULL,
  bus_stop_code TEXT NOT NULL,
  distance_km REAL,
  wd_first TEXT,
  wd_last TEXT,
  sat_first TEXT,
  sat_last TEXT,
  sun_first TEXT,
  sun_last TEXT,
  PRIMARY KEY (generation, service_no, direction, stop_sequence, bus_stop_code)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS bus_route_rows_by_stop
  ON bus_route_rows (generation, bus_stop_code, service_no);
