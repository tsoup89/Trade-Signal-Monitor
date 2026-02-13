const express = require('express');
const { db, randomId } = require('../db');
const { mergeEntities } = require('../entities/entityService');
const { sendWebhook } = require('../alerts/alertService');

const router = express.Router();

function buildFilters(query, alias = 't') {
  const where = [];
  const params = {};
  if (query.type && ['BUY', 'SELL'].includes(query.type.toUpperCase())) { where.push(`${alias}.type=@type`); params.type = query.type.toUpperCase(); }
  if (query.entity) { where.push(`e.canonical_name LIKE @entity`); params.entity = `%${query.entity}%`; }
  if (query.ticker) { where.push(`${alias}.ticker=@ticker`); params.ticker = query.ticker.toUpperCase(); }
  if (query.source_type && ['CONGRESS', '13F'].includes(query.source_type.toUpperCase())) { where.push(`${alias}.source_type=@source_type`); params.source_type = query.source_type.toUpperCase(); }
  if (query.from) { where.push(`date(${alias}.disclosed_date)>=date(@from)`); params.from = query.from; }
  if (query.to) { where.push(`date(${alias}.disclosed_date)<=date(@to)`); params.to = query.to; }
  return { where, params };
}

router.get('/health', (_req, res) => res.json({ ok: true }));

router.get('/trades', (req, res) => {
  try {
    const sortField = ['impact_score', 'disclosed_date', 'amount_max', 'ticker', 'disclosure_lag_days'].includes(req.query.sort) ? req.query.sort : 'impact_score';
    const sortDir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { where, params } = buildFilters(req.query);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT t.*, e.canonical_name AS entity_name, mc.latest_price, mc.avg_volume_30d, mc.market_cap, mc.change_1d_pct, mc.change_5d_pct
      FROM trades t
      JOIN entities e ON t.entity_id = e.entity_id
      LEFT JOIN market_cache mc ON t.ticker = mc.ticker
      ${whereSql}
      ORDER BY t.${sortField} ${sortDir}
      LIMIT ${limit}
    `).all(params);
    res.json({ data: rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/tickers/top', (req, res) => {
  try {
    const { where, params } = buildFilters(req.query);
    where.push('t.ticker IS NOT NULL');
    const rows = db.prepare(`
      SELECT t.ticker, ROUND(SUM(t.impact_score),3) AS total_impact, COUNT(*) AS trade_count
      FROM trades t JOIN entities e ON t.entity_id=e.entity_id
      WHERE ${where.join(' AND ')}
      GROUP BY t.ticker ORDER BY total_impact DESC LIMIT 10
    `).all(params);
    res.json({ data: rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/entities', (_req, res) => {
  const rows = db.prepare('SELECT entity_id, canonical_name FROM entities ORDER BY canonical_name ASC').all();
  res.json({ data: rows });
});

router.get('/entities/:id/trades', (req, res) => {
  const rows = db.prepare(`SELECT t.*, e.canonical_name AS entity_name FROM trades t JOIN entities e ON t.entity_id=e.entity_id WHERE t.entity_id=? ORDER BY date(t.disclosed_date) DESC LIMIT 100`).all(req.params.id);
  res.json({ data: rows });
});

router.post('/admin/entities/merge', (req, res) => {
  try {
    const { from_entity_id, into_entity_id } = req.body;
    mergeEntities(from_entity_id, into_entity_id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/watchlists', (_req, res) => {
  const rows = db.prepare('SELECT * FROM watchlists ORDER BY created_at DESC').all();
  const items = db.prepare('SELECT * FROM watchlist_items').all();
  res.json({ data: rows.map((w) => ({ ...w, items: items.filter((i) => i.watchlist_id === w.watchlist_id) })) });
});

router.post('/watchlists', (req, res) => {
  const id = randomId('watchlist');
  db.prepare('INSERT INTO watchlists (watchlist_id, user_id, name) VALUES (?, ?, ?)').run(id, req.body.user_id || 'user_default', req.body.name || 'New Watchlist');
  res.status(201).json({ watchlist_id: id });
});

router.post('/watchlists/:id/items', (req, res) => {
  const itemId = randomId('item');
  db.prepare('INSERT INTO watchlist_items (item_id, watchlist_id, item_type, entity_id, ticker) VALUES (?, ?, ?, ?, ?)')
    .run(itemId, req.params.id, req.body.item_type, req.body.entity_id || null, req.body.ticker || null);
  res.status(201).json({ item_id: itemId });
});

router.delete('/watchlists/:id/items/:item_id', (req, res) => {
  db.prepare('DELETE FROM watchlist_items WHERE watchlist_id = ? AND item_id = ?').run(req.params.id, req.params.item_id);
  res.json({ ok: true });
});

router.get('/alerts', (_req, res) => {
  const rows = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all();
  res.json({ data: rows });
});

router.post('/alerts', (req, res) => {
  const id = randomId('alert');
  db.prepare('INSERT INTO alerts (alert_id, user_id, channel, target, min_impact_score, enabled) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.body.user_id || 'user_default', req.body.channel, req.body.target, Number(req.body.min_impact_score) || 0, req.body.enabled === false ? 0 : 1);
  res.status(201).json({ alert_id: id });
});

router.patch('/alerts/:id', (req, res) => {
  db.prepare('UPDATE alerts SET min_impact_score = COALESCE(?, min_impact_score), enabled = COALESCE(?, enabled) WHERE alert_id = ?')
    .run(req.body.min_impact_score, req.body.enabled == null ? null : (req.body.enabled ? 1 : 0), req.params.id);
  res.json({ ok: true });
});

router.post('/test-alert', async (req, res) => {
  try {
    if (req.body.channel === 'WEBHOOK') {
      await sendWebhook(req.body.target, { type: 'test', message: 'Trade Signal Monitor test alert' });
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'Email test requires SMTP support in this MVP.' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
});

router.get('/analytics/lag-summary', (req, res) => {
  const days = Number(req.query.range || 30);
  const rows = db.prepare(`
    SELECT e.canonical_name AS entity_name,
      AVG(t.disclosure_lag_days) AS avg_lag,
      COUNT(*) AS count,
      SUM(CASE WHEN t.disclosure_lag_days <= 7 THEN 1 ELSE 0 END) AS lag_le_7,
      SUM(CASE WHEN t.disclosure_lag_days > 30 THEN 1 ELSE 0 END) AS lag_gt_30
    FROM trades t JOIN entities e ON t.entity_id=e.entity_id
    WHERE date(t.disclosed_date) >= date('now', ?)
    GROUP BY e.canonical_name ORDER BY avg_lag DESC
  `).all(`-${days} days`);
  res.json({ data: rows });
});

router.get('/analytics/reaction', (req, res) => {
  const ticker = String(req.query.ticker || '').toUpperCase();
  const days = Number(req.query.range || 90);
  const trades = db.prepare(`
    SELECT t.id, t.disclosed_date, t.reaction_1d_pct, t.reaction_3d_pct, t.reaction_5d_pct, t.benchmark_1d_pct, t.benchmark_5d_pct,
      e.canonical_name AS entity_name
    FROM trades t JOIN entities e ON t.entity_id=e.entity_id
    WHERE t.ticker = ? AND date(t.disclosed_date) >= date('now', ?)
    ORDER BY date(t.disclosed_date) DESC
  `).all(ticker, `-${days} days`);
  const prices = db.prepare('SELECT date, close FROM prices WHERE ticker = ? ORDER BY date DESC LIMIT 120').all(ticker);
  res.json({ data: { ticker, trades, prices } });
});

module.exports = router;
