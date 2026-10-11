# PWA

BrickBot is an installable web app. `vite-plugin-pwa` (Workbox `generateSW`) builds the service worker, and the manifest is a static file.

## Files
| Path | What |
|---|---|
| `frontend/public/manifest.webmanifest` | Web app manifest, linked from `index.html` (`manifest: false` in the plugin) |
| `frontend/public/icons/*.png` | Committed icons: `icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon` (180) |
| `scripts/icons/maskable.svg` | Full-bleed variant of `favicon.svg` with the B inside the maskable safe zone |
| `scripts/gen-icons.sh` | Re-renders the PNGs |
| `frontend/vite.config.ts` | `VitePWA({...})`: precache globs and every runtime rule |
| `frontend/src/hooks/useInstallPrompt.ts` | `beforeinstallprompt` capture, iOS detection, 30-day dismissal |
| `frontend/src/components/OfflineNotice.tsx`, `pages/OfflinePage.tsx` | `/offline` and the offline error state |

## Icons
```sh
./scripts/gen-icons.sh
```
The script runs `rsvg-convert` in a throwaway `alpine:3.22` container, so no host tools are needed. Georgia isn't available there, so the B renders in DejaVu Serif Bold. Rerun it only when `favicon.svg` or `maskable.svg` change, then commit the PNGs.

## Service worker
Only production builds have one (`devOptions` is off), so `make dev` behaves as before.

**Precache:** `**/*.{js,css,html,svg,png,webmanifest}` from `dist/`, which covers the app shell, the favicon, the icons and the manifest. Every navigation outside `/api/` and `/media/` is answered with the cached `index.html`, so all routes, `/admin` included, load offline.

**Runtime rules (same-origin GET only; nothing else is matched):**
| Match | Strategy | Expiry |
|---|---|---|
| `/api/profile` | StaleWhileRevalidate | 1 entry, 1h |
| `/api/listings`, `/api/listings/featured`, `/api/listings/facets`, `/api/testimonials` | StaleWhileRevalidate | 50 entries, 5m (each query string is its own entry) |
| `/api/listings/{slug}` | NetworkFirst, 5s timeout | 50 entries, 24h |
| `/media/**`, `/images/**` with `request.destination === 'image'` | CacheFirst | 200 entries, 7d |
| `fonts.googleapis.com` / `fonts.gstatic.com` | SWR / CacheFirst | 1 year for font files |

**Never cached:** `/api/chat/**` (including the SSE stream), `/api/admin/**`, `/api/auth/**`, `/api/inquiries`, any POST/PUT/PATCH/DELETE, and videos (Range requests).

**Updates:** `registerType: 'autoUpdate'` with `skipWaiting` + `clientsClaim`. A new build takes over as soon as it installs, and the page switches to it on the next navigation. Outdated precaches are deleted.

**TanStack Query:** queries use `networkMode: 'always'`, so they still fetch while the browser reports offline and the service worker can answer from its cache. With the default mode they'd pause instead. Retries are skipped while `navigator.onLine` is false.

## Testing locally
The dev server has no service worker. Build and preview it in a one-off container:
```sh
docker compose run --rm --no-deps -p 4173:4173 frontend \
  sh -c "npm run build && npx vite preview --host 0.0.0.0 --port 4173"
```
Open http://localhost:4173 (localhost counts as a secure context), then check these in DevTools:
1. **Application → Manifest:** no errors, all icons load, and the maskable preview looks right.
2. **Application → Service workers:** `sw.js` is activated and controlling the page.
3. **Install:** use the install icon in the address bar or our header button. The window should open standalone with the terracotta title bar.
4. **Offline:** browse Home, Listings and one listing, then set **Network → Offline** and reload. The shell, the visited listings and the cached list all render. An unvisited listing shows "You're offline". Sending a chat message shows "Couldn't reach the server…".
5. **Clean slate:** **Application → Storage → Clear site data**.

Lighthouse 12 removed the PWA category, so there's no PWA score anymore. Use the Manifest and Service workers panels instead (or `Page.getInstallabilityErrors` over CDP).
