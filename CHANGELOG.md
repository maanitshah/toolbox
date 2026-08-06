# Changelog

All notable changes to Pear Close Toolbox are logged here, newest first.

## v1.3.0 — 2026-08-05

**Added**
- `.github/workflows/docker-build.yml` — builds the Docker image and publishes it to GitHub Container Registry (ghcr.io) automatically on every push to `main`, using GitHub's own runners. No credentials to manage beyond the repo itself.
- `docker-compose.registry.yml` — an alternative to `docker-compose.yml` that pulls the pre-built image from ghcr.io instead of building locally on the NAS. Once set up, updating is `docker compose pull && docker compose up -d` — no more unzip/copy/rebuild cycle.
- README section walking through one-time GitHub setup and the ongoing pull-based update flow.

## v1.2.1 — 2026-08-05

**Fixed**
- Login sessions wouldn't actually persist when testing over plain `http://<ip>:port` (as opposed to HTTPS). The login cookie was hardcoded to require HTTPS any time `NODE_ENV=production` was set — which it always is in the Docker image — so browsers silently refused to store it during local, pre-Cloudflare testing. You'd sign up successfully but immediately land back on the login screen. The cookie's `Secure` flag is now set dynamically based on whether the actual connection is HTTPS, so it works correctly both for local LAN testing (plain HTTP) and once behind the Cloudflare Tunnel (HTTPS).

## v1.2.0 — 2026-08-05

**Fixed**
- Blank page on load when anything on the network blocks `unpkg.com` (ad-blockers, DNS filtering like AdGuard/Pi-hole, restrictive firewalls). The frontend previously loaded React, ReactDOM, and Babel from a CDN in the browser at runtime — if that CDN was blocked, the page HTML loaded but nothing ever rendered, with no error visible on the server side.

**Changed**
- React/ReactDOM are now bundled at *build time* (via a small `web/` build package using esbuild) into a single local `public/app.bundle.js`. The running app has no runtime dependency on any external CDN — it'll load correctly even fully offline from the internet, so long as it can reach your NAS.
- `docker compose up -d --build` now runs this bundling step automatically as part of a multi-stage Docker build — no extra step required.
- Google Fonts is still loaded from `fonts.googleapis.com` for styling only; if that's blocked the app still works fine, it just falls back to system fonts.

## v1.1.1 — 2026-08-05

**Changed**
- Default host port moved from 3000 → 3500 (3000 is commonly already taken — AdGuard, in this case). The app still listens on port 3000 *inside* the container; only the host-side mapping in `docker-compose.yml` changed. Edit the left-hand side of the `"3500:3000"` line to pick any other free port.

## v1.1.0 — 2026-08-05

**Added**
- Photo on every tool listing. Uploads are compressed client-side (max 1280px, JPEG) before they ever reach the server, so a 12MB phone photo doesn't fill up the NAS.
- Detailed tool fields: brand, model, power type (corded / cordless / manual), and serial number — enough for an owner to confirm they got the same tool back.
- Owners can replace a tool's photo later from the tool's detail view.
- Mobile responsiveness pass: touch-friendly tap targets, a horizontally scrolling tab bar on narrow screens, a 2-column (then 1-column) tool grid on phones, safe-area padding for notched phones, and 16px minimum input font size (stops iOS Safari from zooming in when you tap a field).

**Changed**
- Booking notification emails now include the tool's brand so it's unambiguous which tool was reserved.
- `multer` pinned to 2.x (1.x has known unpatched vulnerabilities).

**Fixed**
- Deleting a tool now also deletes its stored photo file, so orphaned images don't pile up on disk.

## v1.0.0 — 2026-08-05

Initial self-hosted release, replacing the earlier in-browser prototype.

**Added**
- Real accounts: email + password sign-up and sign-in (bcrypt-hashed, JWT session cookie).
- SQLite database (via better-sqlite3) as the single source of truth for tools and bookings — shared across every signed-in neighbor, not scoped to a browser.
- Tool listings: name, category, condition, description, owner.
- Search, category filter, and "available on this date" filter.
- Per-tool calendar showing existing bookings, a computed next-available date, and date-range reservation with overlap prevention.
- Email notification to the tool owner (via your own SMTP/Gmail) the moment someone reserves their tool.
- "My stuff" view: tools you've listed, tools you've reserved, cancel your own upcoming bookings.
- Guidelines page covering the borrow/return/replace-if-broken agreement.
- Docker + docker-compose packaging for self-hosting (built and tested for Synology Container Manager).

## v0.1.0 — 2026-08-05 (superseded)

First working prototype, built as a self-contained in-browser demo (no backend — data lived in the chat artifact's storage, shared by link only). Established the core interaction model later carried into v1.0.0: search/filter, per-tool calendar, next-available-date logic, and the borrow/return/replace guidelines. Retired once real accounts and email notifications required a backend.
