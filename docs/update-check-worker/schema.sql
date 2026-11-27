CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  version TEXT NOT NULL,
  info INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS instances_last_seen ON instances (last_seen);
