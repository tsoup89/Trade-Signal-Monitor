const state = { sort: 'impact_score', dir: 'desc', rows: [], watchlists: [] };

const fmtPct = (v) => (v == null ? '-' : `${Number(v).toFixed(2)}%`);
const money = (a, b) => `$${Number(a || 0).toLocaleString()} - $${Number(b || 0).toLocaleString()}`;

function buildQuery() {
  const params = new URLSearchParams();
  params.set('sort', state.sort);
  params.set('dir', state.dir);
  const range = document.getElementById('range').value;
  if (range !== 'custom') {
    const d = new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10);
    params.set('from', d);
  } else {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    if (from) params.set('from', from);
    if (to) params.set('to', to);
  }
  ['type', 'entity', 'ticker', 'source_type'].forEach((k) => {
    const v = document.getElementById(k).value.trim();
    if (v) params.set(k, v);
  });
  return params;
}

async function loadEntities() {
  const json = await (await apiFetch('/api/entities')).json();
  document.getElementById('entityList').innerHTML = json.data.map((e) => `<option value="${e.canonical_name}"></option>`).join('');
}

function renderTrades(rows) {
  document.querySelector('#tradesTable tbody').innerHTML = rows.map((r) => `
    <tr>
      <td>${r.impact_score?.toFixed(3) || '-'}</td>
      <td>${r.disclosed_date || '-'}</td>
      <td><a href="${pageUrl('entity.html', `id=${encodeURIComponent(r.entity_id)}`)}">${r.entity_name}</a></td>
      <td>${r.ticker || '-'}</td>
      <td>${r.ticker ? `<button onclick="watchTicker('${r.ticker}')">★ Ticker</button>` : ''} <button onclick="watchEntity('${r.entity_id}')">★ Entity</button></td>
      <td>${r.source_type}</td>
      <td class="${r.type === 'BUY' ? 'buy' : 'sell'}">${r.type}</td>
      <td>${money(r.amount_min, r.amount_max)}</td>
      <td>${r.disclosure_lag_days ?? '-'}</td>
      <td>${fmtPct(r.reaction_1d_pct)}</td>
      <td>${fmtPct(r.reaction_5d_pct)}</td>
      <td>${fmtPct((r.reaction_1d_pct ?? 0) - (r.benchmark_1d_pct ?? 0))}</td>
      <td>${fmtPct((r.reaction_5d_pct ?? 0) - (r.benchmark_5d_pct ?? 0))}</td>
    </tr>`).join('');
}

async function loadTrades() {
  const q = buildQuery();
  const trades = await (await apiFetch(`/api/trades?${q.toString()}`)).json();
  state.rows = trades.data || [];
  renderTrades(state.rows);
  const top = await (await apiFetch(`/api/tickers/top?${q.toString()}`)).json();
  document.getElementById('topTickers').innerHTML = (top.data || []).map((t) => `<li><b>${t.ticker}</b>: ${t.total_impact}</li>`).join('');
  document.getElementById('printLink').href = pageUrl('print.html', q.toString());

  const lag = await (await apiFetch(`/api/analytics/lag-summary?range=${document.getElementById('range').value === 'custom' ? 30 : document.getElementById('range').value}`)).json();
  document.getElementById('lagWidget').innerHTML = (lag.data || []).slice(0, 5).map((x) => `<li>${x.entity_name}: avg ${Number(x.avg_lag || 0).toFixed(1)} days</li>`).join('');
}

function downloadCsv() {
  const cols = ['entity_name', 'ticker', 'source_type', 'type', 'disclosed_date', 'disclosure_lag_days', 'impact_score', 'reaction_1d_pct', 'reaction_5d_pct'];
  const lines = [cols.join(',')].concat(state.rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'trades.csv'; a.click();
}

async function ensureDefaultWatchlist() {
  const data = await (await apiFetch('/api/watchlists')).json();
  state.watchlists = data.data || [];
  if (!state.watchlists.length) {
    await apiFetch('/api/watchlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Default Watchlist' }) });
    return ensureDefaultWatchlist();
  }
  document.getElementById('watchlists').innerHTML = state.watchlists.map((w) => `<li><b>${w.name}</b> (${w.items.length} items)</li>`).join('');
}

window.watchTicker = async (ticker) => {
  const w = state.watchlists[0];
  if (!w) return;
  await apiFetch(`/api/watchlists/${w.watchlist_id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: 'TICKER', ticker }) });
  ensureDefaultWatchlist();
};
window.watchEntity = async (entity_id) => {
  const w = state.watchlists[0];
  if (!w) return;
  await apiFetch(`/api/watchlists/${w.watchlist_id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: 'ENTITY', entity_id }) });
  ensureDefaultWatchlist();
};

document.getElementById('createWatchlist').onclick = async () => {
  await apiFetch('/api/watchlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('watchlistName').value }) });
  ensureDefaultWatchlist();
};

document.getElementById('createAlert').onclick = async () => {
  await apiFetch('/api/alerts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: document.getElementById('alertChannel').value, target: document.getElementById('alertTarget').value, min_impact_score: Number(document.getElementById('alertMinImpact').value) })
  });
  loadAlerts();
};

document.getElementById('sendTestAlert').onclick = async () => {
  await apiFetch('/api/test-alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: document.getElementById('alertChannel').value, target: document.getElementById('alertTarget').value }) });
};

async function loadAlerts() {
  const json = await (await apiFetch('/api/alerts')).json();
  document.getElementById('alertsList').innerHTML = (json.data || []).map((a) => `<li>${a.channel} → ${a.target} (min impact ${a.min_impact_score})</li>`).join('');
}

document.getElementById('apply').addEventListener('click', loadTrades);
document.getElementById('csv').addEventListener('click', downloadCsv);
document.querySelectorAll('th[data-sort]').forEach((th) => th.addEventListener('click', () => { state.dir = state.sort === th.dataset.sort && state.dir === 'desc' ? 'asc' : 'desc'; state.sort = th.dataset.sort; loadTrades(); }));

loadEntities().then(loadTrades);
ensureDefaultWatchlist();
loadAlerts();
