require('dotenv').config();
const { migrate } = require('../db');
const { ingestAllSources } = require('../ingestion/ingestService');
const { loadSeedEntities } = require('../entities/entityService');

(async () => {
  migrate();
  loadSeedEntities();
  const result = await ingestAllSources();
  console.log(result);
})();
