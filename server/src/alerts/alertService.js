const { db, randomId } = require('../db');

function getMatchingAlertsForTrade(tradeId) {
  const sql = `
    SELECT a.*, t.id AS trade_id, t.ticker, t.entity_id, t.impact_score, t.source_url, e.canonical_name
    FROM trades t
    JOIN alerts a ON a.enabled = 1
    JOIN watchlists w ON w.user_id = a.user_id
    JOIN watchlist_items wi ON wi.watchlist_id = w.watchlist_id
    LEFT JOIN entities e ON t.entity_id = e.entity_id
    WHERE t.id = ?
      AND t.impact_score >= a.min_impact_score
      AND (
        (wi.item_type = 'ENTITY' AND wi.entity_id = t.entity_id)
        OR
        (wi.item_type = 'TICKER' AND wi.ticker = t.ticker)
      )
  `;
  return db.prepare(sql).all(tradeId);
}

async function sendWebhook(target, payload) {
  const res = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Webhook failed with status ${res.status}`);
}

async function sendEmail(_target, _payload) {
  if (!process.env.SMTP_HOST) {
    throw new Error('SMTP not configured');
  }
}

async function fireAlert(alert, payload) {
  if (alert.channel === 'WEBHOOK') return sendWebhook(alert.target, payload);
  return sendEmail(alert.target, payload);
}

async function processAlertsForTrades(trades) {
  for (const trade of trades) {
    const alerts = getMatchingAlertsForTrade(trade.id);
    for (const alert of alerts) {
      const exists = db.prepare('SELECT 1 FROM alert_events WHERE alert_id = ? AND trade_id = ?').get(alert.alert_id, trade.id);
      if (exists) continue;
      try {
        await fireAlert(alert, {
          trade,
          entity: alert.canonical_name,
          impact_score: trade.impact_score,
          source_url: trade.source_url
        });
        db.prepare('INSERT INTO alert_events (event_id, alert_id, trade_id, status) VALUES (?, ?, ?, ?)')
          .run(randomId('event'), alert.alert_id, trade.id, 'SENT');
      } catch (err) {
        db.prepare('INSERT INTO alert_events (event_id, alert_id, trade_id, status, error) VALUES (?, ?, ?, ?, ?)')
          .run(randomId('event'), alert.alert_id, trade.id, 'FAILED', err.message);
      }
    }
  }
}

module.exports = { processAlertsForTrades, sendWebhook };
