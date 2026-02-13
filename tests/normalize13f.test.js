const test = require('node:test');
const assert = require('node:assert/strict');
const { parseInfoTableXml } = require('../server/src/ingestion/source13f');
const { normalize13fHolding } = require('../server/src/ingestion/normalize13f');

test('parseInfoTableXml parses holdings blocks', () => {
  const xml = `
  <informationTable>
    <infoTable>
      <nameOfIssuer>APPLE INC</nameOfIssuer>
      <cusip>037833100</cusip>
      <value>12345</value>
      <shrsOrPrnAmt><sshPrnamt>1000</sshPrnamt></shrsOrPrnAmt>
    </infoTable>
  </informationTable>`;
  const rows = parseInfoTableXml(xml);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].issuer_name, 'APPLE INC');
  assert.equal(rows[0].value_usd, 12345000);
});

test('normalize13fHolding maps to trade schema', () => {
  const normalized = normalize13fHolding({
    manager_name: 'Fund A',
    manager_cik: '0000000001',
    filed_at: '2025-01-01',
    report_period: '2024-12-31',
    accession: '0000000001-25-000001',
    cusip: '123456789',
    issuer_name: 'Issuer',
    value_usd: 500000,
    source_url: 'https://example.com'
  });

  assert.equal(normalized.source_type, '13F');
  assert.equal(normalized.type, 'BUY');
  assert.equal(normalized.amount_max, 500000);
});
