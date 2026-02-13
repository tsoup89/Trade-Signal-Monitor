const crypto = require('crypto');

const HOUSE_SOURCE_URL = 'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json';

function parseAmountRange(amountText) {
  if (!amountText || typeof amountText !== 'string') return { min: 0, max: 0 };
  const clean = amountText.replace(/[$,]/g, '').trim();
  if (clean.includes(' - ')) {
    const [minRaw, maxRaw] = clean.split(' - ');
    return { min: Number(minRaw) || 0, max: Number(maxRaw) || Number(minRaw) || 0 };
  }
  const val = Number(clean) || 0;
  return { min: val, max: val };
}

function normalizeType(typeRaw) {
  const t = String(typeRaw || '').toLowerCase();
  if (t.includes('purchase') || t === 'buy') return 'BUY';
  if (t.includes('sale') || t === 'sell') return 'SELL';
  return null;
}

function makeHash(input) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function normalizeHouseTrade(row) {
  const tradeType = normalizeType(row.type);
  if (!tradeType) return null;
  const amount = parseAmountRange(row.amount);
  const entityName = row.representative || row.entity_name;
  if (!entityName) return null;

  const sourceRecordId = row.transaction_id ? String(row.transaction_id) : null;
  const hash = makeHash([entityName, row.disclosure_date, row.transaction_date, row.ticker, row.amount, tradeType]);

  return {
    source_name: 'house',
    source_trade_id: sourceRecordId ? `house_${sourceRecordId}` : `house_${hash.slice(0, 12)}`,
    source_record_id: sourceRecordId,
    source_hash: hash,
    source_type: 'CONGRESS',
    raw_entity_name: entityName,
    raw_owner_type: 'PERSON',
    chamber: row.chamber || 'House',
    disclosed_date: row.disclosure_date,
    transaction_date: row.transaction_date || null,
    ticker: row.ticker || null,
    asset_name: row.asset_description || row.asset_name || row.ticker || 'Unknown',
    type: tradeType,
    amount_min: amount.min,
    amount_max: amount.max,
    source_url: row.ptr_link || HOUSE_SOURCE_URL,
    amendment_group_id: sourceRecordId ? `house_${sourceRecordId}` : null,
    is_amended: row.amended ? 1 : 0
  };
}

module.exports = { HOUSE_SOURCE_URL, parseAmountRange, normalizeType, normalizeHouseTrade };
