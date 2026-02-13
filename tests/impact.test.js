const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateImpactScore } = require('../server/src/utils/impact');

test('impact score includes cap boost and weight', () => {
  const trade = {
    amount_min: 1000,
    amount_max: 9000,
    disclosed_date: new Date().toISOString().slice(0, 10),
    entity_name: 'Nancy Pelosi'
  };
  const market = { market_cap: 1_000_000_000 };
  const score = calculateImpactScore(trade, market, { entityWeights: { 'Nancy Pelosi': 1.5 } });
  assert.ok(score > 5);
});
