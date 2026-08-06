# Pear Close Toolbox — self-hosted

A shared tool library for one street. Real accounts, a shared SQLite database,
photos and full details on every tool, and an email to the owner the moment
someone reserves their tool. See `CHANGELOG.md` for version history.

## What's in here
```
pear-close-toolbox/
├── server/           Node/Express API (auth, tools, bookings, email, photo uploads)
├── web/              Build-only: bundles React into public/app.bundle.js (no CDN at runtime)
├── public/           Served frontend — index.html + the generated app.bundle.js
├── Dockerfile
├── docker-compose.yml
├── .env.example       Copy to .env and fill in — never commit the real .env
├── CHANGELOG.md
└── data/              Created automatically on first run — SQLite DB + uploaded photos. Back this up.
```

`docker compose up -d --build` handles the frontend bundling step automatically — you never need to run anything in `web/` by hand.

---

## Step 1 — Get a Gmail App Password

Regular Gmail passwords don't work for sending mail through code if you have
2-factor auth on (you should have it on).

1. Go to **https://myaccount.google.com/apppasswords**
2. Sign in, create an app password named something like "Pear Close Toolbox"
3. Google shows you a 16-character code — copy it, you'll need it in Step 2

## Step 2 — Copy the project onto your Synology

Get the whole `pear-close-toolbox` folder onto the NAS. Any of these work:
- **File Station**: upload the folder (or a zip of it, then extract) into somewhere like `/docker/pear-close-toolbox`
- **SSH**: `scp` or `git clone` it into place if you have Git set up
- **Synology Drive / another sync tool** you already use

## Step 3 — Configure secrets

SSH into the NAS (or use Container Manager's terminal) and run:

```bash
cd /volume1/docker/pear-close-toolbox   # wherever you put it
cp .env.example .env
nano .env    # or vi, or edit the file directly in File Station
```

Fill in three things in `.env`:
- `JWT_SECRET` — a random string used to sign login sessions. Generate one with:
  ```bash
  openssl rand -hex 32
  ```
- `SMTP_USER` — your Gmail address
- `SMTP_PASS` — the 16-character app password from Step 1
- `SMTP_FROM` — usually the same as `SMTP_USER`

Leave `SMTP_HOST` and `SMTP_PORT` as-is if you're using Gmail.

## Step 4 — Build and run

**Option A — Container Manager UI** (no SSH needed):
1. Open **Container Manager** on your Synology
2. Go to **Project** → **Create**
3. Point it at the `pear-close-toolbox` folder you copied over (it'll detect `docker-compose.yml`)
4. Build and run — Container Manager handles the rest

**Option B — command line:**
```bash
cd /volume1/docker/pear-close-toolbox
docker compose up -d --build
```

This will take a minute or two the first time — it's compiling a small native module (`better-sqlite3`) as part of the build.

## Step 5 — Check it's alive

```bash
docker compose logs -f
```

You should see:
```
Pear Close Toolbox listening on port 3000
```

From a browser on your home network, visit `http://<synology-ip>:3500` and confirm the sign-up screen loads before moving on to Step 6. Create an account and add a test tool to make sure everything — including a photo upload — works before you open it up to the street.

## Step 6 — Put it on a real domain with your Cloudflare Tunnel

Since you already run a tunnel:
1. In Cloudflare Zero Trust → **Networks → Tunnels**, open your tunnel and add a **Public Hostname**
2. Subdomain: something like `toolbox` → full hostname `toolbox.yourdomain.com`
3. Service: `HTTP`, pointing at `localhost:3500` (or the Synology's LAN IP + `:3500` if the tunnel daemon runs somewhere else on your network)
4. Save, wait for it to propagate, then visit `https://toolbox.yourdomain.com`

That URL is the one link you share in the WhatsApp group — sign-up included.

> The app listens on port 3000 *inside* the container regardless — `3500` is just where it's exposed on the NAS itself. If `3500` is also taken, or you'd rather use something else, change the left-hand number in `docker-compose.yml` (`"3500:3000"`) to any free port and restart with `docker compose up -d`.

## Step 7 — Back it up

Everything that matters lives in the `data/` folder next to `docker-compose.yml`:
- `data/toolbox.db` — every account, tool, and booking
- `data/uploads/` — every tool photo

Back up that one folder however you already back up the NAS (Hyper Backup, a scheduled rsync task, whatever you use). Losing it means losing the whole shelf.

---

## Updating to a new version later

```bash
cd /volume1/docker/pear-close-toolbox
docker compose down
docker compose up -d --build
```

Your `data/` folder isn't touched by rebuilds — accounts, tools, bookings, and photos all survive an update. Database schema changes (like the ones in v1.1.0) apply automatically on startup and only ever *add* columns, never delete data.

## Troubleshooting

**Blank white page on load**
Fixed as of v1.2.0 — the app no longer depends on any CDN at runtime. If you're still on an older build, rebuild with `docker compose up -d --build` to pick up the fix.

**Container won't build / fails on `better-sqlite3`**
The build stage needs `python3`, `make`, and `g++`, which the Dockerfile already installs — if it still fails, check `docker compose logs` for the actual compiler error and make sure the NAS has enough free disk space for the build.

**Sign-up works but no email arrives**
Check `docker compose logs` — if SMTP isn't configured correctly, the server logs the email content instead of sending it (and says so explicitly: `[mailer] SMTP not configured`). Double check `SMTP_USER`/`SMTP_PASS` in `.env` and that you used an **app password**, not your normal Gmail password. Also check spam.

**Photo upload fails**
Uploads are capped at 5MB after client-side compression (which usually gets a phone photo down to a few hundred KB), and only JPEG/PNG are accepted. If it's still failing, check `docker compose logs` for the specific error.

**Forgot to back up before something went wrong**
If `data/toolbox.db` still exists, nothing is lost — it's a single file. Copy it out and inspect it with any SQLite browser if you need to recover something manually.

---

## Optional: deploy from GitHub instead of zip files

Manually unzipping and copying files gets old fast. If you put this project on GitHub, updates become a couple of commands instead of a File Station dance — and it sets you up properly if you ever spin this up for a second street.

There's a GitHub Actions workflow already included (`.github/workflows/docker-build.yml`) that builds the Docker image and publishes it to **GitHub Container Registry (ghcr.io)** automatically, every time you push. Your Synology never has to compile anything — it just downloads the finished image.

### One-time setup
1. **Create a repo on GitHub** (public is simplest — no auth needed to pull later; private works too, just requires one extra login step below)
2. **Push this project to it.** If you don't already use git, GitHub's web UI lets you drag-and-drop the whole folder to create the first commit — no local git install required. (Just make sure `.env` and `data/` aren't included — they're already in `.gitignore`.)
3. Check the **Actions** tab on GitHub — you should see the workflow run and, after a couple minutes, a package show up under your repo's **Packages** sidebar. That's your built image.
4. If your repo is **private**, the package is private too by default, and your Synology will need to authenticate to pull it:
   ```bash
   docker login ghcr.io -u YOUR_GITHUB_USERNAME
   # paste a GitHub Personal Access Token (classic, "read:packages" scope) as the password
   ```
   If your repo is **public**, you can skip this — anonymous pulls just work.

### On the Synology, switch to pulling instead of building
1. Edit `docker-compose.registry.yml` and replace `OWNER/REPO` with your actual GitHub username and repo name
2. Rename it to `docker-compose.yml` (or point Container Manager at it directly)
3. `docker compose up -d` — this pulls the pre-built image instead of building

### From then on, updating is just:
```bash
docker compose pull
docker compose up -d
```
No zip, no File Station, no recompiling `better-sqlite3` on the NAS. `data/` and `.env` are untouched either way.

**A note on how I fit into this going forward:** I still can't push to your repo directly — no stored credentials, and that's by design. When I make changes, I'll keep handing you a zip (or, once you're comfortable with git, a small set of file diffs) that you commit and push yourself. From that point, GitHub Actions takes over automatically.
