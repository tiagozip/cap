CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  reason TEXT NOT NULL,
  blocked_by TEXT,
  agent TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  asn INTEGER,
  as_org TEXT,
  colo TEXT,
  ip_hash TEXT,
  ip TEXT,
  payload TEXT NOT NULL,
  user_info TEXT
);

CREATE INDEX IF NOT EXISTS reports_created_at ON reports (created_at);
CREATE INDEX IF NOT EXISTS reports_reason ON reports (reason);
