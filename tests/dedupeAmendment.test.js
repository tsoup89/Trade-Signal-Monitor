const test = require('node:test');
const assert = require('node:assert/strict');
const { inferAmendment } = require('../server/src/ingestion/dedupe');

test('inferAmendment marks changed record as amended and links superseded', () => {
  const out = inferAmendment({ id: 10, amount_min: 1, amount_max: 2, type: 'BUY' }, { amount_min: 1, amount_max: 5, type: 'BUY' });
  assert.equal(out.isAmended, 1);
  assert.equal(out.supersedesTradeId, 10);
});
