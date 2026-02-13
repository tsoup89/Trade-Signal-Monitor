function inferAmendment(existing, incoming) {
  if (!existing) return { isAmended: incoming.is_amended || 0, supersedesTradeId: null };
  const changed = existing.amount_min !== incoming.amount_min || existing.amount_max !== incoming.amount_max || existing.type !== incoming.type;
  if (incoming.is_amended || changed) return { isAmended: 1, supersedesTradeId: existing.id };
  return { isAmended: existing.is_amended || 0, supersedesTradeId: existing.supersedes_trade_id || null };
}

module.exports = { inferAmendment };
