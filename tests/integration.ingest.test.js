const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveEntityIdInMemory } = require('../server/src/entities/matching');
const { inferAmendment } = require('../server/src/ingestion/dedupe');
const { shouldTriggerAlert } = require('../server/src/alerts/matching');

test('integration happy path (mocked): resolve -> amend infer -> alert match', () => {
  const entityId = resolveEntityIdInMemory('pelosi nancy', [{ alias: 'Pelosi, Nancy', normalized_alias: 'pelosinancy', entity_id: 'e1' }]);
  const amend = inferAmendment({ id: 4, amount_min: 1000, amount_max: 2000, type: 'BUY' }, { amount_min: 1000, amount_max: 3000, type: 'BUY' });
  const trigger = shouldTriggerAlert({ entity_id: entityId, ticker: 'AAPL', impact_score: 5 }, [{ item_type: 'ENTITY', entity_id: 'e1' }], 1);
  assert.equal(entityId, 'e1');
  assert.equal(amend.supersedesTradeId, 4);
  assert.equal(trigger, true);
});
