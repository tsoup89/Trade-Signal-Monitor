const { db } = require('../db');

function toISODate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function computeDisclosureLag(transactionDate, disclosedDate) {
  if (!transactionDate || !disclosedDate) return null;
  const tx = new Date(transactionDate);
  const dd = new Date(disclosedDate);
  const days = Math.floor((dd - tx) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function computeReturnsFromSeries(series, offsets = [1, 3, 5]) {
  if (!series || series.length < 2) return {};
  const t0 = series[0].close;
  const out = {};
  for (const o of offsets) {
    const p = series[Math.min(o, series.length - 1)]?.close;
    out[o] = p ? ((p - t0) / t0) * 100 : null;
  }
  return out;
}

async function fetchDailySeries(ticker) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey || !ticker) return [];
  const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(ticker)}&outputsize=compact&apikey=${apiKey}`);
  const json = await res.json();
  const ts = json['Time Series (Daily)'];
  if (!ts) return [];
  const rows = Object.entries(ts).map(([date, v]) => ({ date, close: Number(v['4. close']) }));
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows;
}

function findFromDate(series, date) {
  const d = toISODate(date);
  const idx = series.findIndex((r) => r.date <= d);
  if (idx < 0) return [];
  return series.slice(idx, idx + 6);
}

async function enrichTradeAnalytics(trade) {
  const lag = computeDisclosureLag(trade.transaction_date, trade.disclosed_date);
  let reaction = { 1: null, 3: null, 5: null };
  let bench = { 1: null, 3: null, 5: null };

  if (trade.ticker) {
    const tSeries = await fetchDailySeries(trade.ticker);
    reaction = computeReturnsFromSeries(findFromDate(tSeries, trade.disclosed_date));

    const bSeries = await fetchDailySeries('SPY');
    bench = computeReturnsFromSeries(findFromDate(bSeries, trade.disclosed_date));
  }

  return {
    disclosure_lag_days: lag,
    reaction_1d_pct: reaction[1],
    reaction_3d_pct: reaction[3],
    reaction_5d_pct: reaction[5],
    benchmark_1d_pct: bench[1],
    benchmark_5d_pct: bench[5]
  };
}

function savePrices(ticker, series) {
  if (!ticker || !series?.length) return;
  const stmt = db.prepare('INSERT OR REPLACE INTO prices (ticker, date, close) VALUES (?, ?, ?)');
  const tx = db.transaction((rows) => rows.forEach((r) => stmt.run(ticker, r.date, r.close)));
  tx(series);
}

module.exports = { computeDisclosureLag, computeReturnsFromSeries, enrichTradeAnalytics, fetchDailySeries, savePrices };
