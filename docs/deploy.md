# Deploy

## Deployment overview
- **Frontend:** Vercel. It's a static build and always live.
- **Backend:** the api container on your PC, reached through a Cloudflare Tunnel. It's live only while the PC and `cloudflared` are running.
- **Database:** local Postgres in Docker, the same as in dev.
- **Routing:** Vercel rewrites `/api/*` and `/media/*` to the tunnel (`frontend/vercel.json`). From the browser's side, everything is same-origin: no CORS headers are needed, and the session cookie stays first-party with `SameSite=Lax`.
- **When the tunnel is down:** the pages show WhatsApp/Call fallbacks instead of errors (`BackendDownFallback`, step 11b-1).

## Prerequisites
- The repo pushed to GitHub.
- A Vercel account (free).
- A Cloudflare account (free) for a named tunnel. You don't need one for a quick tunnel, but its URL changes on every restart.
- `cloudflared` installed on the PC.
- Optional: a domain on Cloudflare, for a stable backend subdomain.

## Step 1: Start the Cloudflare Tunnel
Bring the stack up first (`make dev`). The api listens on `localhost:8080`.

### Option A: Quick tunnel (no account; the URL changes on restart)
```sh
cloudflared tunnel --url http://localhost:8080
```
Copy the printed URL (for example, `https://random-words-1234.trycloudflare.com`). Every time you restart `cloudflared`, the URL changes, so you have to update `vercel.json` and push again.

### Option B: Named tunnel (stable URL; needs a domain on Cloudflare)
```sh
cloudflared tunnel login
cloudflared tunnel create brickbot
cloudflared tunnel route dns brickbot backend.yourdomain.com
cloudflared tunnel run --url http://localhost:8080 brickbot
```
The tunnel URL is then `https://backend.yourdomain.com`. It's stable, so you set it once. `--url` tells the tunnel where to send traffic. You can drop it if you use an ingress rule in `~/.cloudflared/config.yml` instead.

Use a named tunnel if this will run long-term. A quick tunnel is fine for a short demo.

Check the tunnel works before going further: `curl https://<tunnel-host>/api/healthz` should answer.

## Step 2: Update vercel.json
`frontend/vercel.json` contains the placeholder `REPLACE-WITH-TUNNEL-URL`. Comments aren't allowed in JSON, so the note lives here.
- Replace **both** occurrences (the `/api` rule and the `/media` rule) with your tunnel host. Keep `https://` and leave no trailing slash.
- Keep the last rule (`/(.*)` → `/index.html`), and keep it last. It's the SPA fallback: without it, reloading a deep link such as `/listings/<slug>` returns a 404.
- Commit and push. Vercel redeploys on push.

## Step 3: Update the backend .env
Set these three in the project-root `.env`. Never commit it.
```sh
APP_ORIGIN=https://your-app.vercel.app
COOKIE_SECURE=true
TRUST_PROXY=true
```
Then recreate the api so it picks them up. `docker compose restart` does **not** re-read `.env`:
```sh
docker compose up -d api
```
- **No CORS setting:** the backend has none and doesn't need one. The browser never calls the tunnel directly.
- **`APP_ORIGIN` holds exactly one origin.** While it holds the Vercel URL, POSTs from local dev (login, inquiries, chat on `localhost:5173`) get a 403. Switch it back to `http://localhost:5173` and recreate the api when you develop locally.
- **Order:** your exact Vercel URL isn't known until the first deploy (Step 4). You can deploy first and then set `APP_ORIGIN`. Until you do, only POSTs fail; pages and listings load.

## Step 4: Deploy to Vercel
1. On vercel.com, go to **Add New → Project** and import the repo.
2. Configure it:
   | Setting | Value |
   |---|---|
   | Root Directory | `frontend` |
   | Framework Preset | Vite |
   | Build Command | default (`npm run build`) |
   | Output Directory | default (`dist`) |
   | Environment Variables | none |
3. Deploy.
4. Copy the URL Vercel gives you, for example `https://brickbot-xyz.vercel.app`.

Vercel builds on glibc Linux with `npm ci`. `package-lock.json` already lists `@rollup/rollup-linux-x64-gnu`, so the build needs no extra dependency.

To build locally, use the container, not host Node (`frontend/node_modules` is installed by the Alpine container):
```sh
docker compose run --rm --no-deps frontend npm run build
```

## Step 5: Final .env update
Put the real Vercel URL into `APP_ORIGIN` (with `https://` and no trailing slash), then recreate the api:
```sh
docker compose up -d api
```

## Step 6: Verify
1. Open the Vercel URL on desktop and on mobile.
2. **Home:** the hero and the featured listings render with real data.
3. **/listings:** the filters work and results show. Reload a filtered URL and a listing URL (this checks the SPA fallback).
4. **Listing detail:** the gallery loads and the inquiry form submits.
5. **Chat:** send a message and confirm the reply streams in token by token, not all at once at the end.
6. **/admin/login:** log in and confirm you're redirected to `/admin/inquiries`.
7. Stop `cloudflared` (or turn the PC off) and reload. The WhatsApp fallbacks should appear.
8. Start it again and reload. The site should recover.

## Troubleshooting
- **403 on POST (login, inquiry, chat):** `APP_ORIGIN` doesn't match the browser's `Origin` header. Set it to the exact Vercel URL (with `https://`, no trailing slash) and run `docker compose up -d api`. A Vercel preview deployment has its own URL, so POSTs from it get a 403 too.
- **Not logged in after a successful login:** check that `COOKIE_SECURE=true`, that the api was recreated, and that the login went through the Vercel URL. The cookie is `SameSite=Lax`, `Path=/api`, with no `Domain`; that's correct for the rewrite setup. Don't switch it to `SameSite=None`, which is only for a cross-origin setup (see the last item).
- **Every request returns 502 or 530:** `cloudflared` isn't running, or the host in `vercel.json` is stale (quick tunnels change on restart).
- **Chat replies arrive all at once, or get cut off:** the rewrite may be buffering or timing out the SSE stream. Check Vercel's current limits for external rewrites. The workaround is to call the tunnel directly from the browser. That's a code change, not a setting: an API base URL in `src/lib/api.ts`, CORS with credentials on the backend, and a `SameSite=None; Secure` cookie.
- **Login rate limit trips for everyone:** see "Client IPs behind the proxy" below.

### Client IPs behind the proxy
The backend rate-limits per IP (login: 5 per 15 minutes). With `TRUST_PROXY=true`, it takes the **last** `X-Forwarded-For` entry, the one the nearest proxy appended. Here the chain is browser → Vercel → Cloudflare → `cloudflared` → api. Cloudflare appends the address of whoever connected to it, which is Vercel's server, so the IP the backend sees is most likely a Vercel egress IP, not the visitor's. Visitors routed through the same Vercel region will share a limit. `TRUST_PROXY=false` is worse: every visitor becomes the tunnel's address. Per-visitor limits need a backend change (reading the client entry Vercel adds), which isn't done yet.

## Keeping it live
- The site has backend data only while your PC is on and the tunnel is running.
- When it's off, the frontend still works and shows the WhatsApp fallbacks.
- A named tunnel run as a system service survives reboots (`cloudflared service install`). That isn't covered here.
