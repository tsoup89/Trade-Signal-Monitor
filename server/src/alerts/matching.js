function matchesWatchItem(trade, item) {
  if (item.item_type === 'ENTITY') return item.entity_id === trade.entity_id;
  if (item.item_type === 'TICKER') return item.ticker === trade.ticker;
  return false;
}

function shouldTriggerAlert(trade, items, minImpact) {
  if ((trade.impact_score || 0) < (minImpact || 0)) return false;
  return items.some((i) => matchesWatchItem(trade, i));
}

function isEventDuplicate(existingEvents, alertId, tradeId) {
  return existingEvents.some((e) => e.alert_id === alertId && e.trade_id === tradeId);
}

module.exports = { matchesWatchItem, shouldTriggerAlert, isEventDuplicate };
