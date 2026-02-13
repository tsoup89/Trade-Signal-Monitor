const crypto = require('crypto');

function hash13f(row) {
  return crypto.createHash('sha256').update(JSON.stringify([row.manager_cik, row.accession, row.cusip, row.value_usd])).digest('hex');
}

function normalize13fHolding(row) {
  if (!row.manager_name || !row.filed_at) return null;
  const value = Number(row.value_usd) || 0;
  const hash = hash13f(row);
  return {
    source_name: 'sec_13f',
    source_trade_id: `13f_${row.manager_cik}_${row.accession}_${row.cusip || row.issuer_name}`,
    source_record_id: `${row.accession}_${row.cusip || row.issuer_name}`,
    source_hash: hash,
    source_type: '13F',
    raw_entity_name: row.manager_name,
    raw_owner_type: 'ORGANIZATION',
    chamber: null,
    disclosed_date: row.filed_at,
    transaction_date: row.report_period || null,
    ticker: row.ticker || null,
    asset_name: row.issuer_name || row.cusip || 'Unknown',
    type: 'BUY',
    amount_min: value,
    amount_max: value,
    source_url: row.source_url,
    amendment_group_id: `${row.manager_cik}_${row.accession}`,
    is_amended: String(row.accession || '').includes('/A') ? 1 : 0
  };
}

module.exports = { normalize13fHolding };
