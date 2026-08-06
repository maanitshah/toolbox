# Changelog

All notable changes to Pear Close Toolbox are logged here, newest first.

## v1.6.0 — 2026-08-05

**Added**
- Admin panel (new "Admin" tab, visible only to admins). Lets an admin:
  - See every account on the street, with their tool count
  - Create an account manually on someone's behalf
  - Reset anyone's password — generates a one-time temporary password to hand off directly (no email required)
  - Grant or revoke admin access for other accounts
  - Remove an account entirely (cascades to their tool listings and bookings, and cleans up any photo files)
  - Remove any tool from the shelf, regardless of owner
  - Add a tool "on behalf of" any account, from the same Add a Tool form everyone else uses
- New `ADMIN_EMAILS` setting in `.env` — comma-separated list of emails to grant admin access to. Applied on container startup, so a restart is needed after changing it. See the updated `.env.example`.

**Note:** if you're deploying this from a build several versions behind (as you are — last deploy was before the image `contain` fix), this update also brings in everything from v1.3.3–v1.5.0: photo display fix, forgot-password flow, and email validation with an account-repair path. See those entries below for details.

## v1.5.0 — 2026-08-05

**Added**
- Email format validation on sign-up, both client-side (inline feedback as you type) and server-side (authoritative — closes the gap that let an account get created with `maanitshah` as its "email," which silently broke reservation notifications for that account).
- Account settings on the "My stuff" tab: shows your current email, with a "Change" option that requires your current password to confirm it's really you. This is also the fix for any account that got created with a bad email before this validation existed — sign in, go to My stuff, change it, and your existing tool listings and account stay exactly where they are.
- If your account's email doesn't look valid, you'll now see a warning banner on "My stuff" and a small red dot on that tab in the nav, so it's hard to miss.

## v1.4.0 — 2026-08-05

**Added**
- Forgot-password flow. "Forgot your password?" on the login screen sends a one-hour reset link to the account's email (via your existing SMTP config). Clicking it opens a "set a new password" screen, and the link can't be reused after it's used once or once it expires.
- The response to a reset request is identical whether or not the email actually has an account, so the feature can't be used to check which of your neighbors' emails are registered.

## v1.3.3 — 2026-08-05

**Fixed**
- Tool photos were being cropped (`object-fit: cover`) on both the browse-grid cards and the detail/reservation view. Switched to `object-fit: contain`, so the whole photo is always visible — any empty space around it is filled with the app's background color instead of cutting off part of the image.

**Changed**
- The mailer now logs a confirmation line (`[mailer] sent to ...`) on every successful send, not just failures — makes it possible to confirm from `docker compose logs` whether a notification email actually went out, without needing to guess.

## v1.3.2 — 2026-08-05

**Fixed**
- `docker-compose.registry.yml` now sets `pull_policy: always`, so restarting the container always re-checks GHCR for the current `latest` image instead of silently reusing whatever was pulled last time. Previously, Synology Container Manager's "Build" action on a registry-based (non-`build:`) service would just restart the existing local image without pulling — updates required either the Registry tab (which doesn't work with GHCR — see note below) or manually pinning a specific commit-sha tag each time.
- Documented why: Synology's Registry tab search is built around Docker Hub's legacy search API, which GHCR (and most non-Docker-Hub registries) don't implement. Pulling a *known* image reference always worked fine — only the search-to-discover-and-download flow in that specific UI tab was the problem.

## v1.3.1 — 2026-08-05

**Added**
- A small build indicator in the bottom-right corner of every screen (e.g. `build #7 · a1b2c3d`), so you can confirm at a glance whether the NAS is actually running the version you just pushed — compare it against the run number and commit shown on the GitHub Actions tab.
- `GET /api/version` — the endpoint behind the badge, in case you want to check it via `curl` instead.

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
