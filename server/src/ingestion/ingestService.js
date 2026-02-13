const { db } = require('../db');
const { fetchHouseTransactions } = require('./sourceHouse');
const { normalizeHouseTrade } = require('./normalize');
const { fetchLatest13fHoldings } = require('./source13f');
const { normalize13fHolding } = require('./normalize13f');
const { getMarketDataForTicker } = require('../market/marketService');
const { calculateImpactScore } = require('../utils/impact');
const { resolveEntity } = require('../entities/entityService');
const { enrichTradeAnalytics } = require('../analytics/reactionService');
const { processAlertsForTrades } = require('../alerts/alertService');
const { inferAmendment } = require('./dedupe');

async function transformTrade(row) {
  const entityId = resolveEntity(row.raw_entity_name, row.raw_owner_type, row.chamber);
  const market = await getMarketDataForTicker(row.ticker);
  const weight = db.prepare('SELECT default_weight FROM entities WHERE entity_id = ?').get(entityId)?.default_weight || 1.0;
  const impact = calculateImpactScore({ ...row, entity_name: row.raw_entity_name }, market || {}, { entityWeights: { [row.raw_entity_name]: weight } });
  const analytics = await enrichTradeAnalytics(row);

  return {
    ...row,
    entity_id: entityId,
    impact_score: impact,
    ...analytics,
    last_seen_at: new Date().toISOString()
  };
}

function upsertTrade(row) {
  const existing = row.source_record_id
    ? db.prepare('SELECT * FROM trades WHERE source_name = ? AND source_record_id = ?').get(row.source_name, row.source_record_id)
    : db.prepare('SELECT * FROM trades WHERE source_name = ? AND source_hash = ?').get(row.source_name, row.source_hash);

  const amend = inferAmendment(existing, row);

  const stmt = db.prepare(`
    INSERT INTO trades (
      source_name, source_trade_id, source_record_id, source_hash, entity_id, source_type, disclosed_date, transaction_date,
      disclosure_lag_days, ticker, asset_name, type, amount_min, amount_max, source_url, impact_score,
      reaction_1d_pct, reaction_3d_pct, reaction_5d_pct, benchmark_1d_pct, benchmark_5d_pct,
      last_seen_at, is_amended, supersedes_trade_id, amendment_group_id, updated_at
    ) VALUES (
      @source_name, @source_trade_id, @source_record_id, @source_hash, @entity_id, @source_type, @disclosed_date, @transaction_date,
      @disclosure_lag_days, @ticker, @asset_name, @type, @amount_min, @amount_max, @source_url, @impact_score,
      @reaction_1d_pct, @reaction_3d_pct, @reaction_5d_pct, @benchmark_1d_pct, @benchmark_5d_pct,
      @last_seen_at, @is_amended, @supersedes_trade_id, @amendment_group_id, datetime('now')
    )
    ON CONFLICT(source_name, source_record_id) DO UPDATE SET
      entity_id=excluded.entity_id,
      disclosed_date=excluded.disclosed_date,
      transaction_date=excluded.transaction_date,
      disclosure_lag_days=excluded.disclosure_lag_days,
      ticker=excluded.ticker,
      asset_name=excluded.asset_name,
      type=excluded.type,
      amount_min=excluded.amount_min,
      amount_max=excluded.amount_max,
      source_url=excluded.source_url,
      impact_score=excluded.impact_score,
      reaction_1d_pct=excluded.reaction_1d_pct,
      reaction_3d_pct=excluded.reaction_3d_pct,
      reaction_5d_pct=excluded.reaction_5d_pct,
      benchmark_1d_pct=excluded.benchmark_1d_pct,
      benchmark_5d_pct=excluded.benchmark_5d_pct,
      last_seen_at=excluded.last_seen_at,
      is_amended=excluded.is_amended,
      supersedes_trade_id=excluded.supersedes_trade_id,
      amendment_group_id=excluded.amendment_group_id,
      updated_at=datetime('now')
  `);

  const data = {
    ...row,
    is_amended: amend.isAmended,
    supersedes_trade_id: amend.supersedesTradeId
  };

  if (!row.source_record_id && existing) {
    db.prepare(`
      UPDATE trades SET
        entity_id=@entity_id, source_type=@source_type, disclosed_date=@disclosed_date, transaction_date=@transaction_date,
        disclosure_lag_days=@disclosure_lag_days, ticker=@ticker, asset_name=@asset_name, type=@type,
        amount_min=@amount_min, amount_max=@amount_max, source_url=@source_url, impact_score=@impact_score,
        reaction_1d_pct=@reaction_1d_pct, reaction_3d_pct=@reaction_3d_pct, reaction_5d_pct=@reaction_5d_pct,
        benchmark_1d_pct=@benchmark_1d_pct, benchmark_5d_pct=@benchmark_5d_pct, last_seen_at=@last_seen_at,
        is_amended=@is_amended, supersedes_trade_id=@supersedes_trade_id, amendment_group_id=@amendment_group_id,
        updated_at=datetime('now')
      WHERE id=@id
    `).run({ ...data, id: existing.id });
    return db.prepare('SELECT * FROM trades WHERE id = ?').get(existing.id);
  }

  stmt.run(data);
  return db.prepare('SELECT * FROM trades WHERE source_name = ? AND source_trade_id = ? ORDER BY id DESC LIMIT 1').get(row.source_name, row.source_trade_id);
}

async function ingestRows(rows) {
  const inserted = [];
  for (const row of rows) {
    if (!row?.disclosed_date) continue;
    const transformed = await transformTrade(row);
    const saved = upsertTrade(transformed);
    if (saved) inserted.push(saved);
  }
  return inserted;
}

async function ingestCongressTrades() {
  const rawRows = await fetchHouseTransactions();
  const normalized = rawRows.map(normalizeHouseTrade).filter(Boolean);
  const inserted = await ingestRows(normalized);
  return { rawCount: rawRows.length, insertedOrUpdated: inserted.length, insertedRows: inserted };
}

async function ingest13fHoldings() {
  const rawRows = await fetchLatest13fHoldings();
  const normalized = rawRows.map(normalize13fHolding).filter(Boolean);
  const inserted = await ingestRows(normalized);
  return { rawCount: rawRows.length, insertedOrUpdated: inserted.length, insertedRows: inserted };
}

async function ingestAllSources() {
  const congress = await ingestCongressTrades();
  const holdings13f = await ingest13fHoldings();
  const allNew = [...congress.insertedRows, ...holdings13f.insertedRows];
  await processAlertsForTrades(allNew);
  return {
    congress: { rawCount: congress.rawCount, insertedOrUpdated: congress.insertedOrUpdated },
    holdings13f: { rawCount: holdings13f.rawCount, insertedOrUpdated: holdings13f.insertedOrUpdated }
  };
}

module.exports = { ingestCongressTrades, ingest13fHoldings, ingestAllSources, ingestRows };
