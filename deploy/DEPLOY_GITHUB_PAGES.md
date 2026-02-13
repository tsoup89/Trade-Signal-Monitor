# Deploy frontend on GitHub Pages (free)

GitHub Pages can host the `web/` frontend only. The Express + SQLite backend must run elsewhere (Render/Fly/local server/VPS).

## 1) Deploy backend somewhere public
- Start your backend and keep `/api/health` reachable on HTTPS.
- Example backend URL: `https://trade-signal-monitor-api.onrender.com`

## 2) Set CORS on backend
Set this in backend environment:

```bash
WEB_ORIGIN=https://<your-github-username>.github.io
```

For project pages include repo name in origin path still same origin host.

## 3) Configure repo for Pages
1. Push this repository to GitHub.
2. In GitHub repo, go to **Settings → Pages** and set **Source: GitHub Actions**.
3. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `PAGES_API_BASE_URL=https://your-backend-url`

## 4) Trigger deploy
- Push to `main`, or run workflow manually in **Actions → Deploy frontend to GitHub Pages**.

The workflow publishes the `web/` directory and injects `web/config.js` with `PAGES_API_BASE_URL`.

## 5) Share URL
Your app will be available at:

`https://<username>.github.io/<repo>/`

## Notes
- If backend is on a free tier with sleep mode, first API request can be slow.
- GitHub Pages is static hosting; ingestion jobs still run on backend only.
