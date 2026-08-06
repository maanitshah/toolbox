# Pear Close Toolbox — Operations Runbook

Personal reference for deploying updates and recovering when something breaks.
Live site: **https://toolbox.smileclickmemories.com**
Repo: `maanitshah/toolbox` on GitHub
NAS path: `/volume1/docker/pear-close-toolbox`

If you're reading this because something's broken, jump straight to **[Troubleshooting](#troubleshooting)**.

---

## The standard update loop

Use this every time you get new files from Claude.

### 1. Get the new files onto your computer
Unzip whatever Claude gave you. Note which files changed — usually just a few, not the whole project.

### 2. Copy into your local repo
1. Open **GitHub Desktop** → make sure `toolbox` is the current repository
2. **Repository → Show in Explorer** (opens the real folder on disk)
3. Copy the changed files in, overwriting the old ones
   - **Full catch-up needed?** (missed several versions) — delete everything in that folder except the hidden `.git` folder, then copy in the *entire* contents of the latest zip. Don't cherry-pick individual files when you're several versions behind; files move location between versions and stale leftovers cause bugs (this happened once — the Babel/blank-page incident).

### 3. Commit and push
1. Back in GitHub Desktop, confirm it shows the changed files
2. Summary box: something like `vX.Y.Z — short description`
3. **Commit to main**
4. **Push origin**

### 4. Wait for the build
GitHub repo → **Actions** tab → wait for a green checkmark on the new run. This is GitHub building the Docker image and publishing it to `ghcr.io/maanitshah/toolbox`. Takes a minute or two.

**Don't skip this step** — if you restart the container before this finishes, you'll just get the old image again.

### 5. Restart the container on the NAS
Container Manager's **Stop** button is unreliable for this project (it hangs/fails silently — a known recurring issue, not something you're doing wrong). Skip straight to the reliable method:

**Open PowerShell** and connect to the NAS:
```powershell
ssh your-dsm-username@<synology-ip>
```
Enter your DSM password when prompted.

**Find the running container:**
```bash
sudo docker ps -a | grep pear-close-toolbox
```
This prints something like:
```
7c9faf706f40   ghcr.io/maanitshah/toolbox:latest   ...   Up 19 minutes   ...   pear-close-toolbox
```
Copy the container ID (the short hex string at the start, e.g. `7c9faf706f40`).

**Kill it:**
```bash
sudo docker kill 7c9faf706f40
```
(Substitute the real ID/name from the previous command.)

**Confirm it's actually down:**
```bash
sudo docker ps -a | grep pear-close-toolbox
```
Status should now say `Exited (...)` instead of `Up ...`.

You can close the SSH session now (`exit` or just close the window).

### 6. Rebuild/pull in Container Manager
Back in the browser:
1. Container Manager → **Project** → `pear-close-toolbox`
2. **Action → Build**

Because `docker-compose.yml` has `pull_policy: always`, this re-checks GHCR for the current `latest` image and pulls it fresh — it won't just restart the old one.

### 7. Verify
- **Log** tab → should show `Pear Close Toolbox listening on port 3000` with a recent timestamp
- Load **https://toolbox.smileclickmemories.com**
- Check the small version badge in the bottom-right corner of the page — the commit hash there should match the commit you just pushed on GitHub (visible on the repo's main page)

If the badge matches, you're done. If it doesn't, go to [Troubleshooting](#troubleshooting).

---

## Quick reference: the SSH commands only

For when you already know what you're doing and just need the commands:

```powershell
ssh your-dsm-username@<synology-ip>
sudo docker ps -a | grep pear-close-toolbox
sudo docker kill <container-id-or-name>
sudo docker ps -a | grep pear-close-toolbox   # confirm Exited
exit
```
Then: Container Manager → Project → `pear-close-toolbox` → **Action → Build**.

---

## Where things live / how to get back in

| Thing | Where |
|---|---|
| Live site | https://toolbox.smileclickmemories.com |
| GitHub repo | github.com/maanitshah/toolbox |
| Build status | repo → **Actions** tab |
| Built images | repo → **Packages** (or github.com/maanitshah?tab=packages) |
| NAS project | Container Manager → Project → `pear-close-toolbox` |
| Project path on NAS | `/volume1/docker/pear-close-toolbox` |
| Env vars / secrets | `.env` file in that folder (File Station) — **not** in git |
| Database + photos | `data/` folder in that same path — **back this up** |
| Gmail app password | myaccount.google.com/apppasswords (if it ever needs regenerating) |
| Cloudflare Tunnel config | Cloudflare Zero Trust dashboard → Networks → Tunnels |
| Admin access | `.env` → `ADMIN_EMAILS=` (comma-separated, restart to apply) — or promote someone from inside the app's Admin tab once you have access yourself |

---

## Troubleshooting

### Container Manager's Stop button hangs / shows a blank terminal / "No such container"
Known issue with this Synology version's Project actions. Don't fight it — go straight to the SSH kill command in step 5 above.

### Blank white page when you load the site
Shouldn't happen anymore as of v1.2.0 (the app no longer loads anything from an external CDN at runtime). If it somehow recurs: open browser DevTools (F12) → Console, check for errors. If you see anything mentioning `unpkg.com` or `babel`, that means stale files snuck back into the repo — do a full clean replace (see step 2's "full catch-up" note).

### Version badge doesn't match what you just pushed
Actions run didn't finish, or the pull in step 6 didn't actually happen. Re-check the Actions tab is green, then redo step 5-6 (kill + rebuild) — Container Manager sometimes needs the container fully gone before a rebuild actually re-pulls.

### Signed in but bounced back to login screen immediately
Shouldn't happen — fixed in v1.2.1 (cookies now correctly work over both HTTP and HTTPS). If it recurs, check the browser console for cookie warnings.

### Forgot a password (yours or a neighbor's)
- Self-service: "Forgot your password?" on the login screen (needs SMTP working)
- As admin: Admin tab → find the account → **Reset password** → gives you a one-time temp password to hand off directly, no email needed

### Someone's account email is broken (like the original `maanitshah` typo)
My Stuff tab will show a warning banner + red dot if your own account's email looks invalid. Fix: My Stuff → Account → Change. If the correct email is already taken by an empty duplicate account, remove the duplicate first via the Admin tab (you may need to temporarily promote the account you're stuck on to admin to remove the other one — see the "duplicate account" saga in chat history if this comes up again).

### Not receiving reservation/reminder emails
Check `docker compose logs` (or Container Manager's Log tab) around the time the email should have sent — every attempt logs either `[mailer] sent to ...` (success) or `[mailer] FAILED sending to ...` with the actual error. If it says "SMTP not configured," check `.env` has real values for `SMTP_USER`/`SMTP_PASS`. Also just check spam.

### Need to change the exposed port again
Edit the `"3500:3000"` line in `docker-compose.yml` (left number is the host port, right is fixed at 3000 inside the container). Restart same as usual.

### Truly stuck, nothing above helps
1. Confirm the actual state of things independent of any UI: `sudo docker ps -a` (SSH) and `sudo docker logs <container-id>` for the real error
2. Worst case, your data is safe as long as `data/toolbox.db` and `data/uploads/` exist untouched on disk — the container itself is fully disposable and rebuildable from GitHub at any time

---

## Full history of what's changed and why
See `CHANGELOG.md` in the repo — every version from the original prototype onward, with the reasoning behind each fix.
