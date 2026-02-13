# Trade Signal Monitor (Extended MVP)

Trade Signal Monitor is an informational dashboard for U.S. Congress disclosures and 13F holdings with impact scoring, watchlists/alerts, entity resolution, amendment handling, and lag/reaction analytics.

## Updated file tree

```text
.
├── package.json
├── .env.example
├── server/src/
│   ├── index.js
│   ├── api/routes.js
│   ├── alerts/alertService.js
│   ├── analytics/reactionService.js
│   ├── cli/ingest.js
│   ├── data/entitySeeds.json
│   ├── db/{index.js,schema.sql}
│   ├── entities/entityService.js
│   ├── ingestion/{ingestService.js,normalize.js,normalize13f.js,sourceHouse.js,source13f.js}
│   ├── market/marketService.js
│   └── utils/impact.js
├── tests/
│   ├── alerts.test.js
│   ├── analytics.test.js
│   ├── dedupeAmendment.test.js
│   ├── entityResolution.test.js
│   ├── impact.test.js
│   ├── integration.ingest.test.js
│   ├── normalize.test.js
│   └── normalize13f.test.js
└── web/
   ├── index.html
   ├── app.js
   ├── entity.html
   ├── entity.js
   ├── print.html
   ├── print.js
   └── styles.css
```

## New major capabilities

### 1) Watchlists + Alerts
- Watchlists for ENTITY/TICKER tracking.
- Alerts with WEBHOOK and EMAIL channel model.
- Idempotent alert events (unique alert_id+trade_id).
- API endpoints:
  - `GET/POST /api/watchlists`
  - `POST /api/watchlists/:id/items`
  - `DELETE /api/watchlists/:id/items/:item_id`
  - `GET/POST /api/alerts`
  - `PATCH /api/alerts/:id`
  - `POST /api/test-alert`

### 2) Disclosure lag + price reaction analytics
- Trade-level fields: `disclosure_lag_days`, `reaction_1d/3d/5d_pct`, benchmark vs SPY fields.
- Historical close cache table `prices`.
- API endpoints:
  - `GET /api/analytics/lag-summary?range=30`
  - `GET /api/analytics/reaction?ticker=AAPL&range=90`

### 3) Entity resolution + dedupe/amendments
- Canonical entities table + aliases table.
- Seed alias list for notable entities.
- Resolution flow: exact alias -> fuzzy normalized alias -> create new entity.
- Dedupe by source keys and hash.
- Amendment inference and `supersedes_trade_id` linkage.
- Admin merge endpoint:
  - `POST /api/admin/entities/merge`

## Environment variables

Copy `.env.example` to `.env`.

- `PORT` server port.
- `SQLITE_PATH` sqlite db file path.
- `ALPHA_VANTAGE_API_KEY` market + reaction enrichment.
- `SEC_USER_AGENT` required by SEC API usage policy.
- `HEDGE_FUNDS_13F` JSON array of managers with CIK.
- `SMTP_HOST` optional email transport placeholder.
- `DEFAULT_USER_EMAIL` optional default user email.
- `WEB_ORIGIN` optional allowed frontend origin for CORS (use your GitHub Pages origin when split-hosting).

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

One-off ingest:
```bash
npm run ingest
```

Tests:
```bash
npm test
```


## Option A: Web deployment-ready package

This repo now includes deployment manifests for hosted web deployment:
- `Dockerfile`
- `railway.json`
- `render.yaml`
- `fly.toml`
- `deploy/DEPLOY_OPTION_A.md` (step-by-step guide)

Quick start (Railway):
1. Push repo to GitHub.
2. Create Railway project from repo.
3. Add env vars from `.env.example`.
4. Deploy and share URL with friends.

## Free option: GitHub Pages frontend

You can host the UI for free on GitHub Pages and point it at any public backend URL.

Included support:
- `.github/workflows/deploy-pages.yml` publishes `web/` to Pages.
- Workflow injects `PAGES_API_BASE_URL` into `web/config.js`.
- Frontend now supports configurable API base URL for cross-origin hosting.
- Backend supports optional CORS allow-list via `WEB_ORIGIN`.

Setup steps are documented in `deploy/DEPLOY_GITHUB_PAGES.md`.

## Disclaimer

This tool is informational only and **not investment advice**.
