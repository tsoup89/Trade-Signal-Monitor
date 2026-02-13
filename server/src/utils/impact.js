function getEntityWeight(entityName, config = {}) {
  const map = config.entityWeights || {};
  return map[entityName] || 1.0;
}

function calculateImpactScore(trade, market = {}, config = {}) {
  const avgAmount = ((Number(trade.amount_min) || 0) + (Number(trade.amount_max) || 0)) / 2;
  const base = Math.log10(avgAmount + 1);

  let smallCapBoost = 0;
  const marketCap = Number(market.market_cap);
  if (Number.isFinite(marketCap)) {
    if (marketCap < 2_000_000_000) smallCapBoost = 1;
    else if (marketCap < 10_000_000_000) smallCapBoost = 0.5;
  }

  let recency = 0;
  if (trade.disclosed_date) {
    const disclosed = new Date(trade.disclosed_date);
    const days = (Date.now() - disclosed.getTime()) / (1000 * 60 * 60 * 24);
    recency = Math.max(0, 2 - days / 7);
  }

  const entityWeight = getEntityWeight(trade.entity_name, config);
  return (base + smallCapBoost + recency) * entityWeight;
}

module.exports = { calculateImpactScore, getEntityWeight };
