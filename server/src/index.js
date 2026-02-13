require('dotenv').config();
const path = require('path');
const express = require('express');
const { migrate } = require('./db');
const routes = require('./api/routes');
const { ingestAllSources } = require('./ingestion/ingestService');
const { loadSeedEntities } = require('./entities/entityService');

const app = express();
const port = process.env.PORT || 3000;
const webOrigin = process.env.WEB_ORIGIN || '';

migrate();
loadSeedEntities();

app.use((req, res, next) => {
  if (webOrigin) {
    res.setHeader('Access-Control-Allow-Origin', webOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use('/api', routes);
app.use('/', express.static(path.join(process.cwd(), 'web')));

async function runIngestion() {
  try {
    const result = await ingestAllSources();
    console.log('Ingestion complete:', result);
  } catch (error) {
    console.error('Ingestion failed:', error.message);
  }
}

runIngestion();
setInterval(runIngestion, 6 * 60 * 60 * 1000);

app.listen(port, () => {
  console.log(`Trade Signal Monitor listening on http://localhost:${port}`);
});
