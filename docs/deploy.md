# Deploy

## Deploying the frontend to Vercel
The backend stays on the LAN behind a Cloudflare Tunnel. Vercel serves the static build and proxies `/api` and `/media` to the tunnel, so the frontend keeps using relative paths.

**Project settings**
| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | default (`npm ci`) |

Vercel builds on glibc Linux. `package-lock.json` already lists `@rollup/rollup-linux-x64-gnu`, so no extra dependency is needed. Locally, build in the container (`docker compose run --rm --no-deps frontend npm run build`), not on the host: `frontend/node_modules` is installed by the Alpine (musl) container and won't load under host Node.

**Tunnel URL.** `frontend/vercel.json` contains the placeholder `REPLACE-WITH-TUNNEL-URL` twice, once for `/api` and once for `/media`. After starting the Cloudflare Tunnel, put its hostname in both rules (keep `https://`, with no trailing slash), commit, and redeploy. If the tunnel hostname changes (for example, a quick tunnel restarted), update both rules again. The last rule (`/(.*)` → `/index.html`) is the SPA fallback for client-side routes. Keep it last.

**CORS and cookies.** The browser only ever talks to the Vercel domain, and Vercel forwards `/api` server-side. The requests are same-origin from the browser's point of view:
- No CORS headers are needed on the backend.
- The admin session cookie (`Path=/api`, `SameSite=Lax`, no `Domain`) is set as a first-party cookie for the Vercel domain. Set `COOKIE_SECURE=true` in the backend's `.env`, because the site is served over HTTPS.
- If you ever call the tunnel URL directly from the browser instead of going through the rewrites, all of this changes: you'd need CORS with credentials, plus `SameSite=None; Secure`.

**Check after deploying:** load a listing, refresh a deep link (such as `/listings/<slug>`), log in to `/admin`, and send a chat message. Chat uses SSE through the rewrite, so confirm that tokens stream in and don't all arrive at the end.
