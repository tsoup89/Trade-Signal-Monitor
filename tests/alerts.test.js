const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldTriggerAlert, isEventDuplicate } = require('../server/src/alerts/matching');

test('alert matching by entity and threshold', () => {
  const trade = { entity_id: 'e1', ticker: 'AAPL', impact_score: 3 };
  const items = [{ item_type: 'ENTITY', entity_id: 'e1' }];
  assert.equal(shouldTriggerAlert(trade, items, 2), true);
  assert.equal(shouldTriggerAlert(trade, items, 4), false);
});

test('alert idempotency helper', () => {
  const events = [{ alert_id: 'a1', trade_id: 10 }];
  assert.equal(isEventDuplicate(events, 'a1', 10), true);
  assert.equal(isEventDuplicate(events, 'a1', 11), false);
});
