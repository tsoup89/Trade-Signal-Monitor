const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAlias, resolveEntityIdInMemory } = require('../server/src/entities/matching');

test('normalizeAlias removes punctuation and case', () => {
  assert.equal(normalizeAlias('Pelosi, Nancy'), 'pelosinancy');
});

test('resolveEntityIdInMemory supports exact and fuzzy alias', () => {
  const aliases = [
    { alias: 'Pelosi, Nancy', normalized_alias: 'pelosinancy', entity_id: 'e1' }
  ];
  assert.equal(resolveEntityIdInMemory('Pelosi, Nancy', aliases), 'e1');
  assert.equal(resolveEntityIdInMemory('pelosi nancy', aliases), 'e1');
});
