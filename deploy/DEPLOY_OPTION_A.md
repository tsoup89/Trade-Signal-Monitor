# Option A Deployment-Ready Package (Web)

This repo now includes ready-to-use deployment configs for:
- Railway (`railway.json`)
- Render (`render.yaml`)
- Fly.io (`fly.toml`)
- Docker (`Dockerfile`)

## 1) Prepare environment variables
Set these in your hosting provider dashboard:
- `PORT=3000`
- `SQLITE_PATH=server/data/trades.db`
- `ALPHA_VANTAGE_API_KEY=<your_key>`
- `SEC_USER_AGENT=TradeSignalMonitor/1.0 your-email@example.com`
- `HEDGE_FUNDS_13F=[{"name":"Berkshire Hathaway Inc","cik":"0001067983"}]`
- `DEFAULT_USER_EMAIL=<optional>`
- `SMTP_HOST=<optional>`

## 2) Railway (fastest)
1. Push this repo to GitHub.
2. In Railway: **New Project -> Deploy from GitHub repo**.
3. Railway auto-detects `railway.json` + Dockerfile.
4. Add env vars.
5. Deploy and open URL.

## 3) Render
1. Connect GitHub repo.
2. Render reads `render.yaml`.
3. Add env vars and deploy.

## 4) Fly.io
1. Install Fly CLI.
2. `fly auth login`
3. `fly launch --copy-config --no-deploy`
4. Set secrets:
   ```bash
   fly secrets set ALPHA_VANTAGE_API_KEY=... SEC_USER_AGENT='TradeSignalMonitor/1.0 you@example.com'
   ```
5. `fly deploy`

## 5) Share with friends
- Share your deployed URL directly.
- Optional: create a ZIP package and share source:
  ```bash
  git archive --format=zip --output trade-signal-monitor.zip HEAD
  ```

## Notes
- SQLite is file-based and best for single-instance deployments.
- For larger usage, migrate DB to Postgres.
- App includes a visible informational disclaimer and is not investment advice.
