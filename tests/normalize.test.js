const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAmountRange, normalizeType, normalizeHouseTrade } = require('../server/src/ingestion/normalize');

test('parseAmountRange handles ranges', () => {
  assert.deepEqual(parseAmountRange('$15,001 - $50,000'), { min: 15001, max: 50000 });
});

test('normalizeType maps values', () => {
  assert.equal(normalizeType('purchase'), 'BUY');
  assert.equal(normalizeType('sale_full'), 'SELL');
});

test('normalizeHouseTrade returns normalized record', () => {
  const row = {
    representative: 'Rep A',
    disclosure_date: '2024-01-01',
    transaction_date: '2023-12-30',
    type: 'purchase',
    amount: '$1,001 - $15,000',
    ticker: 'AAPL',
    asset_description: 'Apple Inc',
    transaction_id: 123
  };
  const out = normalizeHouseTrade(row);
  assert.equal(out.raw_entity_name, 'Rep A');
  assert.equal(out.type, 'BUY');
  assert.equal(out.amount_min, 1001);
  assert.equal(out.amount_max, 15000);
});
