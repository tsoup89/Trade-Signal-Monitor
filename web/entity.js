const params = new URLSearchParams(location.search);
const id = params.get('id');

async function ensureWatchlist() {
  const w = await (await apiFetch('/api/watchlists')).json();
  return w.data?.[0]?.watchlist_id;
}

apiFetch(`/api/entities/${encodeURIComponent(id)}/trades`).then((r) => r.json()).then((json) => {
  const rows = json.data || [];
  document.getElementById('title').textContent = `Entity View: ${rows[0]?.entity_name || id}`;
  document.getElementById('entityRows').innerHTML = rows.map((r) => `<tr><td>${r.disclosed_date || '-'}</td><td>${r.ticker || '-'}</td><td>${r.type}</td><td>${r.disclosure_lag_days ?? '-'}</td><td>$${Number(r.amount_min).toLocaleString()} - $${Number(r.amount_max).toLocaleString()}</td><td>${r.impact_score?.toFixed(3) || '-'}</td></tr>`).join('');
});

document.getElementById('watchEntity').onclick = async () => {
  const watchlistId = await ensureWatchlist();
  if (!watchlistId) return;
  await apiFetch(`/api/watchlists/${watchlistId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: 'ENTITY', entity_id: id }) });
};
