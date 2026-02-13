const fs = require('fs');
const path = require('path');
const { db, randomId } = require('../db');

const { normalizeAlias } = require('./matching');

function loadSeedEntities() {
  const seedPath = path.join(__dirname, '..', 'data', 'entitySeeds.json');
  const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const insertEntity = db.prepare('INSERT OR IGNORE INTO entities (entity_id, canonical_name, entity_type, role, alias_json, default_weight) VALUES (?, ?, ?, ?, ?, ?)');
  const insertAlias = db.prepare('INSERT OR IGNORE INTO entity_aliases (alias, entity_id, normalized_alias) VALUES (?, ?, ?)');

  for (const s of seeds) {
    const entityId = `seed_${normalizeAlias(s.canonical_name)}`;
    insertEntity.run(entityId, s.canonical_name, s.entity_type, s.role || null, JSON.stringify(s.aliases || []), s.default_weight || 1.0);
    for (const alias of [s.canonical_name, ...(s.aliases || [])]) {
      insertAlias.run(alias, entityId, normalizeAlias(alias));
    }
  }
}

function resolveEntity(rawName, rawOwnerType, chamber) {
  const name = String(rawName || '').trim();
  if (!name) return null;
  const normalized = normalizeAlias(name);

  const exact = db.prepare('SELECT entity_id FROM entity_aliases WHERE alias = ?').get(name);
  if (exact) return exact.entity_id;

  const fuzzy = db.prepare('SELECT entity_id FROM entity_aliases WHERE normalized_alias = ?').get(normalized);
  if (fuzzy) return fuzzy.entity_id;

  const entityId = randomId('entity');
  const entityType = rawOwnerType === 'ORGANIZATION' ? 'ORGANIZATION' : 'PERSON';
  db.prepare('INSERT INTO entities (entity_id, canonical_name, entity_type, role, alias_json, default_weight) VALUES (?, ?, ?, ?, ?, ?)')
    .run(entityId, name, entityType, chamber || null, JSON.stringify([name]), 1.0);
  db.prepare('INSERT INTO entity_aliases (alias, entity_id, normalized_alias) VALUES (?, ?, ?)').run(name, entityId, normalized);
  return entityId;
}

function mergeEntities(fromEntityId, intoEntityId) {
  const tx = db.transaction(() => {
    db.prepare('UPDATE trades SET entity_id = ? WHERE entity_id = ?').run(intoEntityId, fromEntityId);
    const aliases = db.prepare('SELECT alias FROM entity_aliases WHERE entity_id = ?').all(fromEntityId);
    for (const a of aliases) {
      db.prepare('INSERT OR IGNORE INTO entity_aliases (alias, entity_id, normalized_alias) VALUES (?, ?, ?)')
        .run(a.alias, intoEntityId, normalizeAlias(a.alias));
    }
    db.prepare('DELETE FROM entity_aliases WHERE entity_id = ?').run(fromEntityId);
    db.prepare('DELETE FROM entities WHERE entity_id = ?').run(fromEntityId);
  });
  tx();
}

module.exports = { loadSeedEntities, resolveEntity, mergeEntities, normalizeAlias };
