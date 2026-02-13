const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const dbPath = process.env.SQLITE_PATH || path.join(process.cwd(), 'server', 'data', 'trades.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function ensureColumn(table, column, sqlTypeAndDefault) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlTypeAndDefault};`);
  }
}

function compatibilityMigrations() {
  ensureColumn('trades', 'source_name', "TEXT NOT NULL DEFAULT 'house'");
  ensureColumn('trades', 'source_record_id', 'TEXT');
  ensureColumn('trades', 'source_hash', 'TEXT');
  ensureColumn('trades', 'last_seen_at', "TEXT NOT NULL DEFAULT (datetime('now'))");
  ensureColumn('trades', 'is_amended', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('trades', 'supersedes_trade_id', 'INTEGER');
  ensureColumn('trades', 'amendment_group_id', 'TEXT');
  ensureColumn('trades', 'disclosure_lag_days', 'INTEGER');
  ensureColumn('trades', 'reaction_1d_pct', 'REAL');
  ensureColumn('trades', 'reaction_3d_pct', 'REAL');
  ensureColumn('trades', 'reaction_5d_pct', 'REAL');
  ensureColumn('trades', 'benchmark_1d_pct', 'REAL');
  ensureColumn('trades', 'benchmark_5d_pct', 'REAL');
  ensureColumn('trades', 'source_type', "TEXT NOT NULL DEFAULT 'CONGRESS'");

  const hasEntityId = db.prepare('PRAGMA table_info(trades)').all().some((c) => c.name === 'entity_id');
  if (!hasEntityId) {
    db.exec('ALTER TABLE trades ADD COLUMN entity_id TEXT;');
  }
}

function seedDefaultUser() {
  const existing = db.prepare('SELECT user_id FROM users LIMIT 1').get();
  if (!existing) {
    const userId = 'user_default';
    db.prepare('INSERT INTO users (user_id, email) VALUES (?, ?)').run(userId, process.env.DEFAULT_USER_EMAIL || null);
    db.prepare('INSERT INTO watchlists (watchlist_id, user_id, name) VALUES (?, ?, ?)').run('watchlist_default', userId, 'Default Watchlist');
  }
}

function backfillEntitiesFromLegacyNames() {
  const hasEntityName = db.prepare('PRAGMA table_info(trades)').all().some((c) => c.name === 'entity_name');
  if (!hasEntityName) return;
  const rows = db.prepare("SELECT DISTINCT entity_name FROM trades WHERE entity_name IS NOT NULL AND entity_name != ''").all();
  const insertEntity = db.prepare('INSERT OR IGNORE INTO entities (entity_id, canonical_name, entity_type, alias_json, default_weight) VALUES (?, ?, ?, ?, ?)');
  const insertAlias = db.prepare('INSERT OR IGNORE INTO entity_aliases (alias, entity_id, normalized_alias) VALUES (?, ?, ?)');
  const updateTrade = db.prepare('UPDATE trades SET entity_id = ? WHERE entity_name = ? AND (entity_id IS NULL OR entity_id = "")');

  for (const r of rows) {
    const id = `legacy_${r.entity_name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    insertEntity.run(id, r.entity_name, 'PERSON', JSON.stringify([r.entity_name]), 1.0);
    insertAlias.run(r.entity_name, id, r.entity_name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    updateTrade.run(id, r.entity_name);
  }
}

function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  compatibilityMigrations();
  backfillEntitiesFromLegacyNames();
  seedDefaultUser();
}

module.exports = { db, migrate, randomId };
