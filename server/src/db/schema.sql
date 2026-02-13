PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS entities (
  entity_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('PERSON','ORGANIZATION')),
  role TEXT,
  alias_json TEXT NOT NULL DEFAULT '[]',
  default_weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entity_aliases (
  alias TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  FOREIGN KEY(entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_norm ON entity_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL DEFAULT 'house',
  source_trade_id TEXT,
  source_record_id TEXT,
  source_hash TEXT,
  entity_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'CONGRESS',
  disclosed_date TEXT NOT NULL,
  transaction_date TEXT,
  disclosure_lag_days INTEGER,
  ticker TEXT,
  asset_name TEXT,
  type TEXT CHECK(type IN ('BUY', 'SELL')) NOT NULL,
  amount_min REAL NOT NULL,
  amount_max REAL NOT NULL,
  source_url TEXT NOT NULL,
  impact_score REAL DEFAULT 0,
  reaction_1d_pct REAL,
  reaction_3d_pct REAL,
  reaction_5d_pct REAL,
  benchmark_1d_pct REAL,
  benchmark_5d_pct REAL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_amended INTEGER NOT NULL DEFAULT 0,
  supersedes_trade_id INTEGER,
  amendment_group_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(entity_id) REFERENCES entities(entity_id),
  FOREIGN KEY(supersedes_trade_id) REFERENCES trades(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_source_record_unique ON trades(source_name, source_record_id) WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trades_source_hash_unique ON trades(source_name, source_hash) WHERE source_record_id IS NULL AND source_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_disclosed_date ON trades(disclosed_date);
CREATE INDEX IF NOT EXISTS idx_trades_entity_id ON trades(entity_id);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_trades_type ON trades(type);
CREATE INDEX IF NOT EXISTS idx_trades_source_type ON trades(source_type);

CREATE TABLE IF NOT EXISTS market_cache (
  ticker TEXT PRIMARY KEY,
  latest_price REAL,
  avg_volume_30d REAL,
  market_cap REAL,
  change_1d_pct REAL,
  change_5d_pct REAL,
  fetched_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prices (
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  close REAL NOT NULL,
  PRIMARY KEY(ticker, date)
);

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS watchlists (
  watchlist_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  item_id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('ENTITY', 'TICKER')),
  entity_id TEXT,
  ticker TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(watchlist_id) REFERENCES watchlists(watchlist_id) ON DELETE CASCADE,
  FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('WEBHOOK', 'EMAIL')),
  target TEXT NOT NULL,
  min_impact_score REAL NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS alert_events (
  event_id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  trade_id INTEGER NOT NULL,
  fired_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL CHECK(status IN ('SENT', 'FAILED')),
  error TEXT,
  FOREIGN KEY(alert_id) REFERENCES alerts(alert_id) ON DELETE CASCADE,
  FOREIGN KEY(trade_id) REFERENCES trades(id),
  UNIQUE(alert_id, trade_id)
);
