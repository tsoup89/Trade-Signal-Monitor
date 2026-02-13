const { HOUSE_SOURCE_URL } = require('./normalize');

async function fetchHouseTransactions() {
  const response = await fetch(HOUSE_SOURCE_URL);
  if (!response.ok) {
    throw new Error(`House source fetch failed: ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('House source returned non-array payload');
  }
  return data;
}

module.exports = { fetchHouseTransactions };
