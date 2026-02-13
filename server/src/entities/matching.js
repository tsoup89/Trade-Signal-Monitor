function normalizeAlias(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveEntityIdInMemory(rawName, aliasRows) {
  const exact = aliasRows.find((a) => a.alias === rawName);
  if (exact) return exact.entity_id;
  const norm = normalizeAlias(rawName);
  const fuzzy = aliasRows.find((a) => a.normalized_alias === norm);
  return fuzzy ? fuzzy.entity_id : null;
}

module.exports = { normalizeAlias, resolveEntityIdInMemory };
