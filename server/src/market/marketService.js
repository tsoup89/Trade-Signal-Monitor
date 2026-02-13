const { db } = require('../db');

const TTL_MS = 60 * 60 * 1000;

function getCachedMarket(ticker) {
  const row = db.prepare('SELECT * FROM market_cache WHERE ticker = ?').get(ticker);
  if (!row) return null;
  const age = Date.now() - new Date(row.fetched_at).getTime();
  if (age > TTL_MS) return null;
  return row;
}

function upsertMarket(ticker, data) {
  db.prepare(`
    INSERT INTO market_cache (ticker, latest_price, avg_volume_30d, market_cap, change_1d_pct, change_5d_pct, fetched_at, updated_at)
    VALUES (@ticker, @latest_price, @avg_volume_30d, @market_cap, @change_1d_pct, @change_5d_pct, @fetched_at, datetime('now'))
    ON CONFLICT(ticker) DO UPDATE SET
      latest_price=excluded.latest_price,
      avg_volume_30d=excluded.avg_volume_30d,
      market_cap=excluded.market_cap,
      change_1d_pct=excluded.change_1d_pct,
      change_5d_pct=excluded.change_5d_pct,
      fetched_at=excluded.fetched_at,
      updated_at=datetime('now')
  `).run({
    ticker,
    latest_price: data.latest_price,
    avg_volume_30d: data.avg_volume_30d,
    market_cap: data.market_cap,
    change_1d_pct: data.change_1d_pct,
    change_5d_pct: data.change_5d_pct,
    fetched_at: new Date().toISOString()
  });
}

function movingAverage(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function fetchAlphaVantage(ticker) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return {
      latest_price: null,
      avg_volume_30d: null,
      market_cap: null,
      change_1d_pct: null,
      change_5d_pct: null
    };
  }

  const [overviewResp, dailyResp] = await Promise.all([
    fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`),
    fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(ticker)}&outputsize=compact&apikey=${apiKey}`)
  ]);

  const overview = await overviewResp.json();
  const daily = await dailyResp.json();

  if (overview.Note || daily.Note) {
    throw new Error('AlphaVantage rate limit reached');
  }

  const series = daily['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    throw new Error(`No daily series for ${ticker}`);
  }

  const entries = Object.entries(series)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, values]) => ({
      date,
      close: Number(values['4. close']),
      volume: Number(values['5. volume'])
    }));

  const latest = entries[0];
  const prev = entries[1];
  const fifth = entries[5];

  const change1d = latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : null;
  const change5d = latest && fifth ? ((latest.close - fifth.close) / fifth.close) * 100 : null;
  const avg30 = movingAverage(entries.slice(0, 30).map((e) => e.volume));

  return {
    latest_price: latest?.close || null,
    avg_volume_30d: avg30,
    market_cap: Number(overview.MarketCapitalization) || null,
    change_1d_pct: change1d,
    change_5d_pct: change5d
  };
}

async function getMarketDataForTicker(ticker) {
  if (!ticker) return null;
  const cached = getCachedMarket(ticker);
  if (cached) return cached;

  try {
    const fetched = await fetchAlphaVantage(ticker);
    upsertMarket(ticker, fetched);
    return db.prepare('SELECT * FROM market_cache WHERE ticker = ?').get(ticker);
  } catch (error) {
    console.error(`Market data fetch failed for ${ticker}:`, error.message);
    return db.prepare('SELECT * FROM market_cache WHERE ticker = ?').get(ticker) || null;
  }
}

module.exports = { getMarketDataForTicker };
