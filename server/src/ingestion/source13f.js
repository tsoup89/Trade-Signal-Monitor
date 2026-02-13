const SEC_BASE = 'https://data.sec.gov';

const DEFAULT_MANAGERS = [
  { name: 'Berkshire Hathaway Inc', cik: '0001067983' },
  { name: 'Bridgewater Associates, LP', cik: '0001350694' },
  { name: 'Pershing Square Capital Management, L.P.', cik: '0001336528' }
];

function getManagersFromEnv() {
  const raw = process.env.HEDGE_FUNDS_13F;
  if (!raw) return DEFAULT_MANAGERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_err) {}
  return DEFAULT_MANAGERS;
}

function secHeaders() {
  return {
    'User-Agent': process.env.SEC_USER_AGENT || 'TradeSignalMonitor/1.0 your-email@example.com',
    Accept: 'application/json, text/xml;q=0.9, */*;q=0.8'
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: secHeaders() });
  if (!res.ok) throw new Error(`SEC fetch failed ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: secHeaders() });
  if (!res.ok) throw new Error(`SEC fetch failed ${res.status} for ${url}`);
  return res.text();
}

function stripXml(value) {
  return String(value || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return stripXml(m?.[1] || '');
}

function parseInfoTableXml(xmlText) {
  const blocks = xmlText.match(/<infoTable>[\s\S]*?<\/infoTable>/gi) || [];
  return blocks.map((block) => {
    const issuer = extractTag(block, 'nameOfIssuer');
    const valueK = Number(extractTag(block, 'value')) || 0;
    const shares = Number(extractTag(block, 'sshPrnamt')) || 0;
    const putCall = extractTag(block, 'putCall');
    const cusip = extractTag(block, 'cusip');

    return {
      issuer_name: issuer || 'Unknown',
      ticker: null,
      cusip,
      shares,
      value_usd: valueK * 1000,
      put_call: putCall || null
    };
  });
}

async function fetchLatest13fHoldings() {
  const managers = getManagersFromEnv();
  const output = [];

  for (const manager of managers) {
    try {
      const cik = String(manager.cik).padStart(10, '0');
      const submissions = await fetchJson(`${SEC_BASE}/submissions/CIK${cik}.json`);
      const recent = submissions?.filings?.recent;
      if (!recent?.form) continue;

      const idx = recent.form.findIndex((form) => form === '13F-HR' || form === '13F-HR/A');
      if (idx < 0) continue;

      const accession = recent.accessionNumber[idx];
      const reportDate = recent.reportDate?.[idx] || null;
      const filedAt = recent.filingDate?.[idx] || null;
      const accessionNoDash = accession.replace(/-/g, '');
      const cikInt = String(Number(cik));

      const filingIndex = await fetchJson(`${SEC_BASE}/Archives/edgar/data/${cikInt}/${accessionNoDash}/index.json`);
      const infoFile = (filingIndex.directory?.item || []).find((f) => /infotable/i.test(f.name) && /\.xml$/i.test(f.name));
      if (!infoFile) continue;

      const infoXml = await fetchText(`${SEC_BASE}/Archives/edgar/data/${cikInt}/${accessionNoDash}/${infoFile.name}`);
      const holdings = parseInfoTableXml(infoXml);
      for (const h of holdings) {
        output.push({
          manager_name: manager.name,
          manager_cik: cik,
          report_period: reportDate,
          filed_at: filedAt,
          accession,
          source_url: `${SEC_BASE}/Archives/edgar/data/${cikInt}/${accessionNoDash}/index.json`,
          ...h
        });
      }
    } catch (err) {
      console.error(`13F fetch failed for ${manager.name}:`, err.message);
    }
  }

  return output;
}

module.exports = { fetchLatest13fHoldings, parseInfoTableXml, getManagersFromEnv };
