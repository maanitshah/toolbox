require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("./db");
const { sendBookingNotification, sendPasswordResetEmail, sendReturnReminder, sendOverdueNotice } = require("./mailer");

const app = express();
app.set("trust proxy", 1); // so req.secure reflects X-Forwarded-Proto from Cloudflare Tunnel, not just the local connection
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-.env-please";
const COOKIE_NAME = "pearclose_session";

const uploadsDir = path.join(__dirname, "..", "data", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype === "image/jpeg" || file.mimetype === "image/png"),
});

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(uploadsDir, { maxAge: "30d" }));

const id = () => crypto.randomBytes(9).toString("hex");
const today = () => new Date().toISOString().slice(0, 10);
const addDaysStr = (dateStr, n) => { const d = new Date(dateStr + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());

/* ---------- auth helpers ---------- */
function setSession(req, res, user) {
  const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: "180d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure, // true once behind HTTPS (e.g. the Cloudflare Tunnel); false on plain-HTTP LAN testing, so login still works either way
    maxAge: 180 * 24 * 60 * 60 * 1000,
  });
}
function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT id, name, address, email, is_admin FROM users WHERE id = ?").get(payload.uid);
    if (!user) return res.status(401).json({ error: "Not signed in." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Sign in again." });
  }
}
function requireAdmin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: "Admins only." });
  next();
}
function publicUser(u) {
  return { id: u.id, name: u.name, address: u.address, email: u.email, isAdmin: !!u.is_admin, label: `${u.name} · ${u.address}` };
}
function randomPassword() {
  return crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

/* ---------- date helpers (mirrors frontend logic) ---------- */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

/* ================= AUTH ================= */
app.get("/api/version", (req, res) => {
  res.json({
    commit: (process.env.APP_COMMIT || "unknown").slice(0, 7),
    build: process.env.APP_BUILD_NUMBER || "dev",
  });
});

app.post("/api/auth/signup", async (req, res) => {
  const { name, address, email, password } = req.body || {};
  if (!name?.trim() || !address?.trim() || !email?.trim() || !password || password.length < 8) {
    return res.status(400).json({ error: "Name, address, email, and an 8+ character password are all required." });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: "That doesn't look like a valid email address — double check it, since it's how owners will reach you." });
  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
  if (existing) return res.status(409).json({ error: "That email already has an account. Try signing in instead." });

  const hash = await bcrypt.hash(password, 10);
  const user = { id: id(), name: name.trim(), address: address.trim(), email: cleanEmail, password_hash: hash, created_at: Date.now() };
  db.prepare("INSERT INTO users (id, name, address, email, password_hash, created_at) VALUES (@id, @name, @address, @email, @password_hash, @created_at)").run(user);
  setSession(req, res, user);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = (email || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(cleanEmail);
  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
    return res.status(401).json({ error: "Email or password is wrong." });
  }
  setSession(req, res, user);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.post("/api/auth/forgot", async (req, res) => {
  const cleanEmail = (req.body?.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(cleanEmail);
  // Always respond the same way whether or not the account exists, so a stranger
  // can't use this to probe which emails have accounts.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    db.prepare("UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?")
      .run(tokenHash, Date.now() + 60 * 60 * 1000, user.id); // 1 hour
    const resetUrl = `${req.protocol}://${req.get("host")}/?reset=${rawToken}`;
    sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch((e) => console.error("Reset email failed:", e.message));
  }
  res.json({ ok: true });
});

app.post("/api/auth/reset", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || password.length < 8) return res.status(400).json({ error: "Need a valid link and an 8+ character password." });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = db.prepare("SELECT * FROM users WHERE reset_token_hash = ?").get(tokenHash);
  if (!user || !user.reset_token_expires || user.reset_token_expires < Date.now()) {
    return res.status(400).json({ error: "That reset link is invalid or has expired — request a new one." });
  }
  const hash = await bcrypt.hash(password, 10);
  db.prepare("UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?").run(hash, user.id);
  setSession(req, res, user);
  res.json({ user: publicUser(user) });
});

app.get("/api/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.patch("/api/me/email", requireAuth, async (req, res) => {
  const { newEmail, currentPassword } = req.body || {};
  if (!isValidEmail(newEmail)) return res.status(400).json({ error: "That doesn't look like a valid email address." });
  const cleanEmail = newEmail.trim().toLowerCase();

  const fullUser = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!(await bcrypt.compare(currentPassword || "", fullUser.password_hash))) {
    return res.status(401).json({ error: "Current password is wrong." });
  }
  const clash = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(cleanEmail, req.user.id);
  if (clash) return res.status(409).json({ error: "Another account already uses that email." });

  db.prepare("UPDATE users SET email = ? WHERE id = ?").run(cleanEmail, req.user.id);
  res.json({ user: publicUser({ ...req.user, email: cleanEmail }) });
});

/* ================= TOOLS ================= */
function shapeTool(r, currentUserId) {
  return {
    id: r.id, name: r.name, category: r.category, condition: r.condition, description: r.description,
    brand: r.brand || "", model: r.model || "", powerType: r.power_type || "", serialNumber: r.serial_number || "",
    ownerId: r.owner_id, ownerName: `${r.owner_name} · ${r.owner_address}`, isMine: r.owner_id === currentUserId,
    photoUrl: r.photo_updated_at ? `/uploads/${r.id}.jpg?v=${r.photo_updated_at}` : null,
  };
}

app.get("/api/tools", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, u.id as owner_id, u.name as owner_name, u.address as owner_address
    FROM tools t JOIN users u ON u.id = t.owner_id
    ORDER BY t.created_at DESC
  `).all();
  res.json({ tools: rows.map((r) => shapeTool(r, req.user.id)) });
});

app.post("/api/tools", requireAuth, (req, res) => {
  const { name, category, condition, description, brand, model, powerType, serialNumber, ownerId } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Tool name is required." });
  let effectiveOwnerId = req.user.id;
  if (req.user.is_admin && ownerId && ownerId !== req.user.id) {
    const targetOwner = db.prepare("SELECT id FROM users WHERE id = ?").get(ownerId);
    if (!targetOwner) return res.status(400).json({ error: "That owner doesn't exist." });
    effectiveOwnerId = ownerId;
  }
  const tool = {
    id: id(), name: name.trim(), category: category || "other", condition: condition || "Good",
    description: (description || "").trim(), brand: (brand || "").trim(), model: (model || "").trim(),
    power_type: powerType || "", serial_number: (serialNumber || "").trim(),
    owner_id: effectiveOwnerId, created_at: Date.now(),
  };
  db.prepare(`INSERT INTO tools (id, name, category, condition, description, brand, model, power_type, serial_number, owner_id, created_at)
    VALUES (@id, @name, @category, @condition, @description, @brand, @model, @power_type, @serial_number, @owner_id, @created_at)`).run(tool);
  const owner = db.prepare("SELECT name, address FROM users WHERE id = ?").get(effectiveOwnerId);
  res.json({ tool: shapeTool({ ...tool, owner_name: owner.name, owner_address: owner.address }, req.user.id) });
});

app.post("/api/tools/:id/photo", requireAuth, upload.single("photo"), (req, res) => {
  const tool = db.prepare("SELECT * FROM tools WHERE id = ?").get(req.params.id);
  if (!tool) return res.status(404).json({ error: "Tool not found." });
  if (tool.owner_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "Only the owner (or an admin) can change this tool's photo." });
  if (!req.file) return res.status(400).json({ error: "No image received — try a JPEG or PNG under 5MB." });

  fs.writeFileSync(path.join(uploadsDir, `${tool.id}.jpg`), req.file.buffer);
  const photoUpdatedAt = Date.now();
  db.prepare("UPDATE tools SET photo_updated_at = ? WHERE id = ?").run(photoUpdatedAt, tool.id);
  res.json({ photoUrl: `/uploads/${tool.id}.jpg?v=${photoUpdatedAt}` });
});

app.patch("/api/tools/:id", requireAuth, (req, res) => {
  const tool = db.prepare("SELECT * FROM tools WHERE id = ?").get(req.params.id);
  if (!tool) return res.status(404).json({ error: "Tool not found." });
  if (tool.owner_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "Only the owner (or an admin) can edit this tool." });

  const { name, category, condition, description, brand, model, powerType, serialNumber } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Tool name is required." });

  const updated = {
    id: tool.id, name: name.trim(), category: category || "other", condition: condition || "Good",
    description: (description || "").trim(), brand: (brand || "").trim(), model: (model || "").trim(),
    power_type: powerType || "", serial_number: (serialNumber || "").trim(),
  };
  db.prepare(`UPDATE tools SET name=@name, category=@category, condition=@condition, description=@description,
    brand=@brand, model=@model, power_type=@power_type, serial_number=@serial_number WHERE id=@id`).run(updated);

  const owner = db.prepare("SELECT name, address FROM users WHERE id = ?").get(tool.owner_id);
  res.json({ tool: shapeTool({ ...tool, ...updated, owner_name: owner.name, owner_address: owner.address }, req.user.id) });
});

app.delete("/api/tools/:id", requireAuth, (req, res) => {
  const tool = db.prepare("SELECT * FROM tools WHERE id = ?").get(req.params.id);
  if (!tool) return res.status(404).json({ error: "Tool not found." });
  if (tool.owner_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "Only the owner (or an admin) can remove this tool." });
  db.prepare("DELETE FROM tools WHERE id = ?").run(req.params.id);
  const photoPath = path.join(uploadsDir, `${tool.id}.jpg`);
  if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  res.json({ ok: true });
});

/* ================= BOOKINGS ================= */
app.get("/api/bookings", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT b.id, b.tool_id, b.start_date, b.end_date, b.created_at, b.returned_at,
           u.id as borrower_id, u.name as borrower_name, u.address as borrower_address,
           t.owner_id as tool_owner_id
    FROM bookings b JOIN users u ON u.id = b.borrower_id JOIN tools t ON t.id = b.tool_id
    ORDER BY b.start_date ASC
  `).all();
  res.json({ bookings: rows.map((r) => ({
    id: r.id, toolId: r.tool_id, start: r.start_date, end: r.end_date, returnedAt: r.returned_at,
    borrowerId: r.borrower_id, borrowerName: `${r.borrower_name} · ${r.borrower_address}`,
    isMine: r.borrower_id === req.user.id, canCheckin: r.borrower_id === req.user.id || r.tool_owner_id === req.user.id || !!req.user.is_admin,
  })) });
});

app.post("/api/bookings", requireAuth, async (req, res) => {
  const { toolId, start, end } = req.body || {};
  if (!toolId || !start || !end || end < start) return res.status(400).json({ error: "Pick a valid start and end date." });
  if (start < today()) return res.status(400).json({ error: "You can't book a date in the past." });

  const tool = db.prepare("SELECT * FROM tools WHERE id = ?").get(toolId);
  if (!tool) return res.status(404).json({ error: "That tool no longer exists." });

  const clashes = db.prepare("SELECT * FROM bookings WHERE tool_id = ?").all(toolId)
    .some((b) => rangesOverlap(start, end, b.start_date, b.end_date));
  if (clashes) return res.status(409).json({ error: "Someone already has it reserved over part of that range." });

  const owner = db.prepare("SELECT * FROM users WHERE id = ?").get(tool.owner_id);
  const booking = { id: id(), tool_id: toolId, borrower_id: req.user.id, start_date: start, end_date: end, created_at: Date.now() };
  db.prepare("INSERT INTO bookings (id, tool_id, borrower_id, start_date, end_date, created_at) VALUES (@id, @tool_id, @borrower_id, @start_date, @end_date, @created_at)").run(booking);

  const toolLabel = [tool.name, tool.brand].filter(Boolean).join(" — ");
  sendBookingNotification({
    ownerEmail: owner.email, ownerName: owner.name,
    borrowerName: publicUser(req.user).label, toolName: toolLabel, start, end,
  }).catch((e) => console.error("Email notify failed:", e.message));

  res.json({ booking: { id: booking.id, toolId, start, end, returnedAt: null, borrowerId: req.user.id, borrowerName: publicUser(req.user).label, isMine: true, canCheckin: true } });
});

app.post("/api/bookings/:id/checkin", requireAuth, (req, res) => {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  const tool = db.prepare("SELECT owner_id FROM tools WHERE id = ?").get(booking.tool_id);
  const allowed = booking.borrower_id === req.user.id || (tool && tool.owner_id === req.user.id) || req.user.is_admin;
  if (!allowed) return res.status(403).json({ error: "Only the borrower, the tool's owner, or an admin can mark this returned." });
  const returnedAt = Date.now();
  db.prepare("UPDATE bookings SET returned_at = ? WHERE id = ?").run(returnedAt, booking.id);
  res.json({ returnedAt });
});

app.delete("/api/bookings/:id", requireAuth, (req, res) => {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  const tool = db.prepare("SELECT owner_id FROM tools WHERE id = ?").get(booking.tool_id);
  const allowed = booking.borrower_id === req.user.id || (tool && tool.owner_id === req.user.id) || req.user.is_admin;
  if (!allowed) return res.status(403).json({ error: "Only the borrower, the tool's owner, or an admin can cancel this." });
  db.prepare("DELETE FROM bookings WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ================= ADMIN ================= */
app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.address, u.email, u.is_admin, u.created_at,
           (SELECT COUNT(*) FROM tools WHERE owner_id = u.id) as tool_count
    FROM users u ORDER BY u.created_at ASC
  `).all();
  res.json({ users: rows.map((u) => ({
    id: u.id, name: u.name, address: u.address, email: u.email, isAdmin: !!u.is_admin,
    toolCount: u.tool_count, createdAt: u.created_at,
  })) });
});

app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const { name, address, email, password } = req.body || {};
  if (!name?.trim() || !address?.trim() || !isValidEmail(email) || !password || password.length < 8) {
    return res.status(400).json({ error: "Name, address, a valid email, and an 8+ character password are all required." });
  }
  const cleanEmail = email.trim().toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail)) {
    return res.status(409).json({ error: "That email already has an account." });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = { id: id(), name: name.trim(), address: address.trim(), email: cleanEmail, password_hash: hash, created_at: Date.now() };
  db.prepare("INSERT INTO users (id, name, address, email, password_hash, created_at) VALUES (@id, @name, @address, @email, @password_hash, @created_at)").run(user);
  res.json({ user: { id: user.id, name: user.name, address: user.address, email: user.email, isAdmin: false, toolCount: 0, createdAt: user.created_at } });
});

app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "Account not found." });
  const tempPassword = randomPassword();
  const hash = await bcrypt.hash(tempPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?").run(hash, target.id);
  res.json({ tempPassword }); // shown once — not stored anywhere in plaintext, not logged
});

app.patch("/api/admin/users/:id/admin", requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't change your own admin status here." });
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "Account not found." });
  db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(req.body?.isAdmin ? 1 : 0, target.id);
  res.json({ ok: true });
});

app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't remove your own account here." });
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
  if (!target) return res.status(404).json({ error: "Account not found." });

  const theirTools = db.prepare("SELECT id, photo_updated_at FROM tools WHERE owner_id = ?").all(target.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(target.id); // cascades to their tools and bookings
  for (const t of theirTools) {
    const p = path.join(uploadsDir, `${t.id}.jpg`);
    if (t.photo_updated_at && fs.existsSync(p)) fs.unlinkSync(p);
  }
  res.json({ ok: true });
});

function runReminderSweep() {
  const todayStr = today();
  const tomorrowStr = addDaysStr(todayStr, 1);

  // T-24h reminder: bookings due back tomorrow, not yet returned, not already reminded
  const dueSoon = db.prepare(`
    SELECT b.id, b.end_date, t.name as tool_name,
           bu.name as borrower_name, bu.email as borrower_email,
           ou.name as owner_name
    FROM bookings b
    JOIN tools t ON t.id = b.tool_id
    JOIN users bu ON bu.id = b.borrower_id
    JOIN users ou ON ou.id = t.owner_id
    WHERE b.end_date = ? AND b.returned_at IS NULL AND b.reminder_sent_at IS NULL
  `).all(tomorrowStr);
  for (const b of dueSoon) {
    sendReturnReminder({ to: b.borrower_email, name: b.borrower_name, toolName: b.tool_name, dueDate: b.end_date, ownerName: b.owner_name })
      .catch((e) => console.error("Reminder email failed:", e.message));
    db.prepare("UPDATE bookings SET reminder_sent_at = ? WHERE id = ?").run(Date.now(), b.id);
  }

  // Overdue: end date already passed, not returned, not already flagged overdue
  const overdue = db.prepare(`
    SELECT b.id, b.end_date, t.name as tool_name,
           bu.name as borrower_name, bu.email as borrower_email,
           ou.name as owner_name, ou.email as owner_email
    FROM bookings b
    JOIN tools t ON t.id = b.tool_id
    JOIN users bu ON bu.id = b.borrower_id
    JOIN users ou ON ou.id = t.owner_id
    WHERE b.end_date < ? AND b.returned_at IS NULL AND b.overdue_sent_at IS NULL
  `).all(todayStr);
  for (const b of overdue) {
    sendOverdueNotice({ to: b.borrower_email, name: b.borrower_name, toolName: b.tool_name, dueDate: b.end_date, otherPartyName: b.owner_name, isOwner: false })
      .catch((e) => console.error("Overdue email (borrower) failed:", e.message));
    sendOverdueNotice({ to: b.owner_email, name: b.owner_name, toolName: b.tool_name, dueDate: b.end_date, otherPartyName: b.borrower_name, isOwner: true })
      .catch((e) => console.error("Overdue email (owner) failed:", e.message));
    db.prepare("UPDATE bookings SET overdue_sent_at = ? WHERE id = ?").run(Date.now(), b.id);
  }

  if (dueSoon.length || overdue.length) console.log(`[reminders] sweep: ${dueSoon.length} due-tomorrow, ${overdue.length} newly overdue`);
}

function syncAdminsFromEnv() {
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) return;
  const placeholders = emails.map(() => "?").join(",");
  const result = db.prepare(`UPDATE users SET is_admin = 1 WHERE email IN (${placeholders}) AND is_admin = 0`).run(...emails);
  if (result.changes) console.log(`[admin] promoted ${result.changes} account(s) from ADMIN_EMAILS`);
}
syncAdminsFromEnv();

if (require.main === module) {
  app.listen(PORT, () => console.log(`Pear Close Toolbox listening on port ${PORT}`));
  setTimeout(runReminderSweep, 15 * 1000); // once shortly after boot
  setInterval(runReminderSweep, 60 * 60 * 1000); // then hourly
}

module.exports = { app, runReminderSweep };
