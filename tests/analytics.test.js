const test = require('node:test');
const assert = require('node:assert/strict');

function computeDisclosureLag(transactionDate, disclosedDate) {
  if (!transactionDate || !disclosedDate) return null;
  return Math.max(0, Math.floor((new Date(disclosedDate) - new Date(transactionDate)) / 86400000));
}
function computeReturnsFromSeries(series) {
  const t0 = series[0].close;
  return { 1: ((series[1].close - t0) / t0) * 100, 3: ((series[3].close - t0) / t0) * 100, 5: ((series[5].close - t0) / t0) * 100 };
}

test('disclosure lag calculation', () => {
  assert.equal(computeDisclosureLag('2024-01-01', '2024-01-11'), 10);
});

test('reaction calculation synthetic prices', () => {
  const out = computeReturnsFromSeries([{ close: 100 }, { close: 105 }, { close: 110 }, { close: 120 }, { close: 125 }, { close: 130 }]);
  assert.equal(out[1], 5);
  assert.equal(out[5], 30);
});
