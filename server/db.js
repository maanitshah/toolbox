const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "toolbox.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    condition TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    borrower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
// Migrations — additive only, so upgrading never touches existing rows.
ensureColumn("tools", "brand", "brand TEXT DEFAULT ''");
ensureColumn("tools", "model", "model TEXT DEFAULT ''");
ensureColumn("tools", "power_type", "power_type TEXT DEFAULT ''");
ensureColumn("tools", "serial_number", "serial_number TEXT DEFAULT ''");
ensureColumn("tools", "photo_updated_at", "photo_updated_at INTEGER");
ensureColumn("users", "reset_token_hash", "reset_token_hash TEXT");
ensureColumn("users", "reset_token_expires", "reset_token_expires INTEGER");
ensureColumn("users", "is_admin", "is_admin INTEGER DEFAULT 0");
ensureColumn("bookings", "returned_at", "returned_at INTEGER");
ensureColumn("bookings", "reminder_sent_at", "reminder_sent_at INTEGER");
ensureColumn("bookings", "overdue_sent_at", "overdue_sent_at INTEGER");

module.exports = db;
