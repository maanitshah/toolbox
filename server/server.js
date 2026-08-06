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
const { sendBookingNotification } = require("./mailer");

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
    const user = db.prepare("SELECT id, name, address, email FROM users WHERE id = ?").get(payload.uid);
    if (!user) return res.status(401).json({ error: "Not signed in." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Sign in again." });
  }
}
function publicUser(u) {
  return { name: u.name, address: u.address, label: `${u.name} · ${u.address}` };
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

app.get("/api/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

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
  const { name, category, condition, description, brand, model, powerType, serialNumber } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Tool name is required." });
  const tool = {
    id: id(), name: name.trim(), category: category || "other", condition: condition || "Good",
    description: (description || "").trim(), brand: (brand || "").trim(), model: (model || "").trim(),
    power_type: powerType || "", serial_number: (serialNumber || "").trim(),
    owner_id: req.user.id, created_at: Date.now(),
  };
  db.prepare(`INSERT INTO tools (id, name, category, condition, description, brand, model, power_type, serial_number, owner_id, created_at)
    VALUES (@id, @name, @category, @condition, @description, @brand, @model, @power_type, @serial_number, @owner_id, @created_at)`).run(tool);
  res.json({ tool: shapeTool({ ...tool, owner_name: req.user.name, owner_address: req.user.address }, req.user.id) });
});

app.post("/api/tools/:id/photo", requireAuth, upload.single("photo"), (req, res) => {
  const tool = db.prepare("SELECT * FROM tools WHERE id = ?").get(req.params.id);
  if (!tool) return res.status(404).json({ error: "Tool not found." });
  if (tool.owner_id !== req.user.id) return res.status(403).json({ error: "Only the owner can change this tool's photo." });
  if (!req.file) return res.status(400).json({ error: "No image received — try a JPEG or PNG under 5MB." });

  fs.writeFileSync(path.join(uploadsDir, `${tool.id}.jpg`), req.file.buffer);
  const photoUpdatedAt = Date.now();
  db.prepare("UPDATE tools SET photo_updated_at = ? WHERE id = ?").run(photoUpdatedAt, tool.id);
  res.json({ photoUrl: `/uploads/${tool.id}.jpg?v=${photoUpdatedAt}` });
});

app.delete("/api/tools/:id", requireAuth, (req, res) => {
  const tool = db.prepare("SELECT * FROM tools WHERE id = ?").get(req.params.id);
  if (!tool) return res.status(404).json({ error: "Tool not found." });
  if (tool.owner_id !== req.user.id) return res.status(403).json({ error: "Only the owner can remove this tool." });
  db.prepare("DELETE FROM tools WHERE id = ?").run(req.params.id);
  const photoPath = path.join(uploadsDir, `${tool.id}.jpg`);
  if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  res.json({ ok: true });
});

/* ================= BOOKINGS ================= */
app.get("/api/bookings", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT b.id, b.tool_id, b.start_date, b.end_date, b.created_at,
           u.id as borrower_id, u.name as borrower_name, u.address as borrower_address
    FROM bookings b JOIN users u ON u.id = b.borrower_id
    ORDER BY b.start_date ASC
  `).all();
  res.json({ bookings: rows.map((r) => ({
    id: r.id, toolId: r.tool_id, start: r.start_date, end: r.end_date,
    borrowerId: r.borrower_id, borrowerName: `${r.borrower_name} · ${r.borrower_address}`, isMine: r.borrower_id === req.user.id,
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

  res.json({ booking: { id: booking.id, toolId, start, end, borrowerName: publicUser(req.user).label, isMine: true } });
});

app.delete("/api/bookings/:id", requireAuth, (req, res) => {
  const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.borrower_id !== req.user.id) return res.status(403).json({ error: "Only the borrower can cancel this." });
  db.prepare("DELETE FROM bookings WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Pear Close Toolbox listening on port ${PORT}`));
